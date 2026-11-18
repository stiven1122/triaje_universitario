# Sistema de triaje y gestión automatizada de correos universitarios

Plataforma web para que un coordinador reciba, clasifique, filtre y decida (aprobar, rechazar o pedir información) las solicitudes que llegan por correo institucional.

```
Gmail ─▶ n8n (Workflow 1: triaje + IA) ─▶ Supabase ─▶ Backend Express ─▶ Frontend React
                                                           │
Frontend (decisión) ─▶ Backend ─▶ n8n (Workflow 2: webhook) ─▶ Gmail ─▶ solicitante
                                                           └─▶ registro en Supabase
```

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React + Vite | Dashboard, Coordinación, Correos, decisiones. Solo habla con el backend |
| Backend | Node + Express | API REST, validación, auth, estados, historial, llamada al webhook |
| BD | Supabase (PostgreSQL) | Datos, RLS, estadísticas calculadas en SQL |
| Automatización | n8n | Lee Gmail, clasifica con IA, envía las respuestas |

El backend **no** envía correos ni clasifica: eso lo hace n8n. Si n8n falla, el estado **no cambia** y el administrador ve el error.

```
triaje-universitario/
├── frontend/   React + Vite
├── backend/    Express (server.js, src/…)
├── n8n/        workflow_recepcion.json · workflow_respuestas.json
├── database/   schema.sql · policies.sql
└── README.md
```

## Requisitos
Node.js ≥ 18.17 · cuenta de Supabase · n8n (local, Docker o cloud) · cuenta de Gmail · clave de API de Gemini (gratuita en https://aistudio.google.com/apikey).

---

## 1. Base de datos (Supabase)
1. Crea un proyecto en Supabase.
2. **SQL Editor** → pega y ejecuta `database/schema.sql`, y después `database/policies.sql`.
3. **Authentication → Users → Add user**: crea tu usuario (correo + contraseña, marca *Auto Confirm*).
4. Dale acceso al panel (reemplaza el correo) en el SQL Editor:
   ```sql
   insert into public.usuarios (id, email, nombre, rol)
   select id, email, 'Administrador', 'admin' from auth.users where email = 'tu-correo@dominio.edu.co';
   ```
5. **Project Settings → API**: copia `Project URL`, `anon key` y `service_role key`.

> **Si ya ejecutaste una versión anterior de `schema.sql`:** ejecuta además `database/migracion_triaje.sql` (agrega las columnas del triaje y el estado *Revisión manual*). Es seguro repetirla. Si empiezas desde cero, `schema.sql` ya lo incluye.

## 2. Backend
```bash
cd backend
npm install
cp .env.example .env      # completa SUPABASE_*, N8N_WEBHOOK_SECRET
npm run dev               # http://localhost:4000/api/health
```
| Variable | Descripción |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Para validar el login |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso total a la BD. **Solo backend y n8n; nunca en el frontend ni en Git** |
| `N8N_WEBHOOK_URL` | URL del webhook del Workflow 2 (ver paso 3) |
| `N8N_WEBHOOK_SECRET` | Secreto compartido; invéntalo largo y aleatorio |
| `FRONTEND_URL` | Origen permitido por CORS |

## 3. n8n

### 3.1 Credenciales (Credentials → Create)
| Credencial | Tipo | Configuración |
|---|---|---|
| **Gmail account** | *Gmail OAuth2 API* | Client ID/Secret de Google Cloud (ver abajo) |
| **Supabase account** | *Supabase API* | Host = `Project URL`; Service Role Secret = `service_role key` |
| **Gemini API Key** | *Header Auth* | Name: `x-goog-api-key` · Value: tu clave de Gemini |
| **Webhook Triaje Secret** | *Header Auth* | Name: `x-webhook-secret` · Value: **el mismo** `N8N_WEBHOOK_SECRET` del backend |

**Gmail OAuth2:** en Google Cloud Console crea un proyecto → habilita *Gmail API* → pantalla de consentimiento OAuth (agrega tu correo como usuario de prueba) → credenciales *ID de cliente OAuth (aplicación web)* con URI de redirección `http://localhost:5678/rest/oauth2-credential/callback` (la que muestre n8n en la credencial). Pega Client ID/Secret en n8n y pulsa *Sign in with Google*.

### 3.2 Importar los workflows
*Workflows → Import from file*: `n8n/workflow_recepcion.json` y `n8n/workflow_respuestas.json`. En cada nodo con ícono de advertencia (Gmail, Supabase, *Análisis con IA*, *Webhook de entrada*) selecciona la credencial correspondiente.

### 3.3 Activar
Activa ambos (interruptor *Active*). La URL de producción del webhook será `http://localhost:5678/webhook/triaje/respuesta`; ponla en `N8N_WEBHOOK_URL` y reinicia el backend. (Con el workflow sin activar, usa la URL `/webhook-test/…` pulsando *Execute workflow* antes de cada prueba.)

**Workflow 1 · Recepción:** Gmail Trigger (cada minuto, no leídos en INBOX) → Obtener mensaje → Preparar correo → **Control de duplicados** (consulta `gmail_message_id`; además es `UNIQUE` en BD) → IA (Gemini, JSON) → **Validar JSON** (normaliza categoría/prioridad/fechas y calcula campos faltantes) → Insertar `correos` → si requiere decisión, insertar `solicitudes` → marcar leído. Si la IA falla o devuelve JSON inválido, el correo se guarda igualmente con estado **Error de procesamiento** para revisión manual.

**Reglas de triaje (nodo *Reglas de triaje* del Workflow 1).** La IA solo *clasifica* (rol, tipo, categoría); la *decisión* la toma código determinístico, editable en ese nodo:

| Rol del remitente | Propuesta de proyecto | Salida técnica | Otro / consulta |
|---|---|---|---|
| Docente | Pendiente | Pendiente | Revisión manual |
| Estudiante | Pendiente | **Descartado (sin responder)** | Revisión manual |
| Vicerrectoría | Pendiente · prioridad **Alta** | Revisión manual | Revisión manual |
| Desconocido | Revisión manual | Revisión manual | Revisión manual |

- El **rol** se identifica primero por la dirección del remitente (`REGLAS_REMITENTE`; en las pruebas, el sufijo `+docente`, `+estudiante`, `+vicerrectoria`). Si la dirección no coincide, se usa lo que el remitente dice de sí mismo, solo para Docente/Estudiante y dejando constancia de que no está verificado. *Vicerrectoría* solo se acepta por dirección.
- **Pendiente** y **Revisión manual** crean una solicitud; **Descartado** guarda el correo, no crea solicitud y no responde. En ningún caso se envía una respuesta automática: el coordinador decide.
- La **prioridad** la fija la regla (Pendiente/Revisión manual: Media; Vicerrectoría: Alta; Descartado: Baja). La IA solo puede subirla a *Crítica*, nunca en un descarte.
- Para tu universidad real, reemplaza los patrones por dominios (p. ej. `/@docentes\.tuuni\.edu\.co$/i`).

**Workflow 2 · Respuestas:** Webhook (con autenticación) → Validar datos → Switch (aprobar / rechazar / solicitar información) → redacta el correo → **Gmail (responde en el mismo hilo)** → registra en `correos_enviados` → responde al backend. Si Gmail falla, registra el error y responde 502.

## 4. Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```
En desarrollo, Vite redirige `/api` al backend (puerto 4000). En producción define `VITE_API_URL` con la URL pública del backend (`npm run build`). El frontend no contiene ninguna credencial.

---

## Cómo funciona la decisión
- **Aprobar:** observaciones opcionales → confirmar.
- **Rechazar:** motivo obligatorio → confirmar.
- **Solicitar información:** se preseleccionan los campos faltantes detectados + mensaje.
- El backend llama primero a n8n; **solo si el correo se envió** actualiza el estado y escribe en `historial_solicitudes`. Si n8n no responde, el historial registra el intento fallido y el estado no cambia.
- Una solicitud aprobada o rechazada no admite más cambios (409). Las actualizaciones usan control de concurrencia para no pisar decisiones simultáneas.
- La respuesta se envía **siempre al remitente real del correo**, no a una dirección extraída por la IA (evita desvíos por contenido malicioso en el correo).

## API (todas requieren `Authorization: Bearer <token>` salvo health y login)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login → token |
| GET | `/api/correos` | Lista con filtros `q, categoria, prioridad, estado, desde, hasta, urgentes, page, limit` |
| GET | `/api/correos/estadisticas` | Indicadores del dashboard (calculados en SQL) |
| GET | `/api/correos/:id` | Correo + solicitud |
| GET | `/api/solicitudes` | Lista con los mismos filtros (`estado=pendientes|aprobadas|rechazadas|informacion`) |
| GET | `/api/solicitudes/:id` | Detalle + correo + correos enviados |
| PATCH | `/api/solicitudes/:id/estado` | `{estado: 'Aprobada'|'Rechazada'|'En revisión', observaciones?, motivo?}` |
| POST | `/api/solicitudes/:id/responder` | `{mensaje, campos?}` → pide información |
| GET | `/api/solicitudes/:id/historial` | Historial de decisiones |

---

## Guía de prueba de extremo a extremo
1. **Backend:** `curl http://localhost:4000/api/health` → `{"ok":true,…}`.
2. **Login:** abre `http://localhost:5173`, ingresa con el usuario del paso 1.4. Con la BD vacía, el dashboard muestra ceros y estados vacíos (no hay datos de ejemplo).
3. **Recepción:** desde **otra** cuenta de correo envía a la cuenta de Gmail conectada:
   > **Asunto:** Propuesta salida académica a Cartagena
   > Soy Ana Pérez, docente de Ingeniería. Propongo la salida "Ingeniería costera en Cartagena" para 30 estudiantes el 2026-12-05. Presupuesto estimado: $9.000.000. Objetivos: conocer obras portuarias y analizar erosión costera. Adjunto cronograma.
4. En n8n abre *Executions* (o pulsa *Execute workflow* en el Workflow 1): espera ≤ 1 min. Debe terminar en verde.
5. **Supabase → Table editor:** filas nuevas en `correos` (categoría y prioridad) y `solicitudes` (estado *Pendiente*; faltantes esperados: *Justificación*).
6. **Frontend → Resumen → Actualizar:** el correo aparece en *Solicitudes por decidir* y las tarjetas cambian. Revisa *Correos* y *Coordinación* y abre el detalle.
7. **Pedir información:** en el detalle → *Solicitar información* → enviar. El estado pasa a *Información requerida* y llega un correo al remitente (en el mismo hilo).
8. **Aprobar/Rechazar:** prueba ambos con otra solicitud. Verifica: correo recibido, estado actualizado al instante, fila en *Correos enviados* e *Historial de decisiones*.
9. **Duplicados:** en n8n vuelve a ejecutar el Workflow 1 con el mismo mensaje: debe terminar en *Duplicado: se omite* sin crear filas.
10. **Fallo controlado:** desactiva el Workflow 2 e intenta aprobar: el panel muestra el error, el estado **no** cambia y el historial registra el intento fallido.

## Casos de prueba del triaje (R1–R6)
Envía cada correo a la cuenta de Gmail conectada a n8n desde la dirección indicada y comprueba el resultado en **Correos** (columna *Rol · Tipo* y *Estado*) y en el detalle (*Triaje automático*).

| Caso | Remitente | Resultado esperado |
|---|---|---|
| R1 Docente propone un proyecto | `…+docente@gmail.com` | Pendiente, prioridad Media |
| R2 Docente solicita salida técnica | `…+docente@gmail.com` | Pendiente, prioridad Media |
| R3 Estudiante propone un proyecto | `…+estudiante@gmail.com` | Pendiente, prioridad Media |
| R4 Vicerrectoría propone un proyecto | `…+vicerrectoria@gmail.com` | Pendiente, prioridad **Alta** |
| R5 Estudiante solicita salida técnica | `…+estudiante@gmail.com` | **Descartado**, sin solicitud y sin respuesta (filtro *Descartados* en Correos) |
| R6 Consulta de horarios | otra cuenta cualquiera | **Revisión manual** (pestaña *Revisión manual* en Coordinación) |

Entre pruebas no hace falta limpiar nada: cada correo tiene su propio `gmail_message_id`. Si reenvías el mismo mensaje, se omite como duplicado.

## Problemas frecuentes
| Síntoma | Causa probable |
|---|---|
| Login: "no tiene acceso al panel" | Falta el `insert` en `usuarios` (paso 1.4) |
| `502 … No se pudo contactar con n8n` | n8n apagado o `N8N_WEBHOOK_URL` incorrecta |
| `502 … 403` desde n8n | El secreto de *Header Auth* no coincide con `N8N_WEBHOOK_SECRET` |
| `404` del webhook | Workflow 2 sin activar (usa `/webhook-test/` o actívalo) |
| El correo queda en *Error de procesamiento* | Clave de Gemini inválida, cuota agotada o respuesta bloqueada: revisa la ejecución y el `error_detalle` |
| Gmail no responde en el hilo | El `gmail_message_id` debe pertenecer a la cuenta conectada en n8n |

## Notas y límites conocidos
- Los **adjuntos** se registran por nombre/tipo/tamaño; su contenido no se almacena ni se analiza.
- El texto del correo se envía a la API de Gemini para clasificarlo; si hay datos sensibles, cambia de proveedor (solo se tocan los nodos *Construir prompt IA* y *Análisis con IA*; *Validar JSON* espera el formato de respuesta de Gemini).
- El token de sesión dura lo que defina Supabase (≈ 1 h); al expirar el panel pide iniciar sesión de nuevo.
- Los nodos de n8n dependen de la versión instalada; si algún parámetro cambió, n8n lo marca al importar y se ajusta desde la interfaz.
