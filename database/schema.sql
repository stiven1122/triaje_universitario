-- =====================================================================
-- Sistema de triaje y gestión automatizada de correos universitarios
-- Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase > SQL Editor. Luego ejecutar policies.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Utilidad: actualizar updated_at automáticamente
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- USUARIOS (administradores / coordinadores)
-- id coincide con auth.users.id (Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  nombre      text not null,
  rol         text not null default 'coordinador'
              check (rol in ('admin', 'coordinador')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_usuarios_updated
  before update on public.usuarios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- CORREOS (mensaje original + clasificación hecha por n8n/IA)
-- gmail_message_id es UNIQUE: evita duplicados aunque n8n reintente
-- ---------------------------------------------------------------------
create table if not exists public.correos (
  id                 uuid primary key default gen_random_uuid(),
  gmail_message_id   text not null unique,
  gmail_thread_id    text,
  remitente_nombre   text,
  remitente_email    text not null,
  asunto             text not null default '(sin asunto)',
  cuerpo             text not null default '',
  fecha_recepcion    timestamptz not null default now(),
  categoria          text not null default 'Otros'
                     check (categoria in ('Urgente','Académico','Administrativo','Promociones','Otros')),
  prioridad          text not null default 'Media'
                     check (prioridad in ('Crítica','Alta','Media','Baja')),
  resumen            text,
  requiere_decision  boolean not null default false,
  adjuntos           jsonb not null default '[]'::jsonb,
  estado_procesamiento text not null default 'Procesado'
                     check (estado_procesamiento in ('Procesado','Error de procesamiento')),
  error_detalle      text,
  rol_remitente      text check (rol_remitente in ('Docente','Estudiante','Vicerrectoría','Desconocido')),
  tipo_correo        text check (tipo_correo in ('Propuesta de proyecto','Salida técnica','Consulta','Promoción','Otro')),
  decision_triaje    text check (decision_triaje in ('Pendiente','Revisión manual','Descartado')),
  motivo_triaje      text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_correos_decision on public.correos (decision_triaje);
create index if not exists idx_correos_fecha      on public.correos (fecha_recepcion desc);
create index if not exists idx_correos_categoria  on public.correos (categoria);
create index if not exists idx_correos_prioridad  on public.correos (prioridad);
create index if not exists idx_correos_remitente  on public.correos (remitente_email);

-- ---------------------------------------------------------------------
-- SOLICITUDES (una por correo que requiere decisión del administrador)
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes (
  id                   uuid primary key default gen_random_uuid(),
  correo_id            uuid not null unique references public.correos (id) on delete cascade,
  estado               text not null default 'Pendiente'
                       check (estado in ('Pendiente','En revisión','Revisión manual','Aprobada','Rechazada',
                                         'Información requerida','Error de procesamiento')),
  nombre_solicitante   text,
  correo_solicitante   text,
  nombre_proyecto      text,
  tipo_proyecto        text,
  descripcion          text,
  justificacion        text,
  presupuesto          numeric(14,2),
  cantidad_estudiantes integer,
  fecha_realizacion    date,
  destino              text,
  objetivos            jsonb not null default '[]'::jsonb,
  documentos_adjuntos  jsonb not null default '[]'::jsonb,
  informacion_adicional text,
  campos_faltantes     jsonb not null default '[]'::jsonb,
  asignado_a           uuid references public.usuarios (id) on delete set null,
  decidido_por         uuid references public.usuarios (id) on delete set null,
  decidido_en          timestamptz,
  observaciones        text,
  motivo_rechazo       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_solicitudes_estado  on public.solicitudes (estado);
create index if not exists idx_solicitudes_asignado on public.solicitudes (asignado_a);

create trigger trg_solicitudes_updated
  before update on public.solicitudes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- HISTORIAL_SOLICITUDES (auditoría de cada decisión o intento)
-- ---------------------------------------------------------------------
create table if not exists public.historial_solicitudes (
  id               uuid primary key default gen_random_uuid(),
  solicitud_id     uuid not null references public.solicitudes (id) on delete cascade,
  accion           text not null,
  estado_anterior  text,
  estado_nuevo     text,
  observaciones    text,
  usuario_id       uuid references public.usuarios (id) on delete set null,
  usuario_email    text,
  detalle          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists idx_historial_solicitud on public.historial_solicitudes (solicitud_id, created_at desc);

-- ---------------------------------------------------------------------
-- CORREOS_ENVIADOS (respuestas enviadas por n8n vía Gmail)
-- ---------------------------------------------------------------------
create table if not exists public.correos_enviados (
  id                uuid primary key default gen_random_uuid(),
  solicitud_id      uuid not null references public.solicitudes (id) on delete cascade,
  destinatario      text not null,
  asunto            text not null,
  cuerpo            text not null,
  tipo              text not null check (tipo in ('Aprobación','Rechazo','Información')),
  gmail_message_id  text,
  estado_envio      text not null default 'Enviado' check (estado_envio in ('Enviado','Error')),
  error_detalle     text,
  enviado_en        timestamptz not null default now()
);

create index if not exists idx_enviados_solicitud on public.correos_enviados (solicitud_id, enviado_en desc);

-- ---------------------------------------------------------------------
-- ESTADÍSTICAS DEL DASHBOARD (calculadas con datos reales)
-- ---------------------------------------------------------------------
create or replace function public.obtener_estadisticas()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_correos',        (select count(*) from public.correos),
    'correos_urgentes',     (select count(*) from public.correos where categoria = 'Urgente' or prioridad = 'Crítica'),
    'prioridad_alta',       (select count(*) from public.correos where prioridad = 'Alta'),
    'pendientes_decision',  (select count(*) from public.solicitudes where estado in ('Pendiente','En revisión','Revisión manual')),
    'revision_manual',      (select count(*) from public.solicitudes where estado = 'Revisión manual'),
    'descartados',          (select count(*) from public.correos where decision_triaje = 'Descartado'),
    'info_requerida',       (select count(*) from public.solicitudes where estado = 'Información requerida'),
    'total_solicitudes',    (select count(*) from public.solicitudes),
    'solicitudes_asignadas',(select count(*) from public.solicitudes where asignado_a is not null),
    'resueltas',            (select count(*) from public.solicitudes where estado in ('Aprobada','Rechazada')),
    'tasa_resolucion',      (select case when count(*) = 0 then 0
                                    else round(100.0 * count(*) filter (where estado in ('Aprobada','Rechazada')) / count(*), 1)
                                    end
                             from public.solicitudes),
    'tiempo_promedio_respuesta_horas',
                            (select round(avg(extract(epoch from (s.decidido_en - c.fecha_recepcion)) / 3600.0)::numeric, 1)
                             from public.solicitudes s
                             join public.correos c on c.id = s.correo_id
                             where s.decidido_en is not null),
    'por_categoria',        (select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
                             from (select categoria, count(*) as total from public.correos group by categoria) t)
  );
$$;
