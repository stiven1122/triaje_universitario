import { db } from '../config/supabase.js';
import { AppError, lanzarSiError } from '../middlewares/errorHandler.js';
import { correoIdsPorProyecto } from './correos.service.js';
import { invocarWebhookRespuesta } from './n8n.service.js';
import {
  CATEGORIAS,
  PRIORIDADES,
  esUuid,
  finDeDia,
  limpiarBusqueda,
  paginar,
  parsearEstados,
  validarEnum,
  validarFecha,
} from '../utils.js';

const ESTADOS_ABIERTOS = ['Pendiente', 'En revisión', 'Revisión manual', 'Información requerida', 'Error de procesamiento'];
const ESTADOS_FINALES = ['Aprobada', 'Rechazada'];

const SELECT_LISTA = `
  id, estado, nombre_solicitante, nombre_proyecto, tipo_proyecto, presupuesto,
  cantidad_estudiantes, fecha_realizacion, destino, campos_faltantes, asignado_a,
  decidido_en, created_at,
  correos!inner(id, remitente_nombre, remitente_email, asunto, fecha_recepcion, categoria, prioridad)`;

function validarId(id) {
  if (!esUuid(id)) throw new AppError(400, 'El id de la solicitud no es válido', 'VALIDACION');
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------
export async function listarSolicitudes(filtros) {
  const { page, limit, from, to } = paginar(filtros);
  const estados = parsearEstados(filtros.estado);
  const categoria = validarEnum(filtros.categoria, CATEGORIAS, 'categoria');
  const prioridad = validarEnum(filtros.prioridad, PRIORIDADES, 'prioridad');
  const desde = validarFecha(filtros.desde, 'desde');
  const hasta = validarFecha(filtros.hasta, 'hasta');
  const texto = limpiarBusqueda(filtros.q);

  let query = db.from('solicitudes').select(SELECT_LISTA, { count: 'exact' });

  if (estados) query = query.in('estado', estados);
  if (categoria) query = query.eq('correos.categoria', categoria);
  if (prioridad) query = query.eq('correos.prioridad', prioridad);
  if (desde) query = query.gte('correos.fecha_recepcion', desde.toISOString());
  if (hasta) query = query.lte('correos.fecha_recepcion', finDeDia(hasta));
  if (String(filtros.urgentes) === 'true') {
    query = query.or('categoria.eq.Urgente,prioridad.eq.Crítica', { referencedTable: 'correos' });
  }

  if (texto) {
    // Coincidencia en campos de la solicitud o en el remitente/asunto del correo
    const p = `%${texto}%`;
    const { data: correos, error } = await db
      .from('correos')
      .select('id')
      .or(`remitente_nombre.ilike.${p},remitente_email.ilike.${p},asunto.ilike.${p}`)
      .limit(500);
    lanzarSiError(error, 'buscar solicitudes');
    const ids = (correos || []).map((c) => c.id);
    const condiciones = [
      `nombre_proyecto.ilike.${p}`,
      `nombre_solicitante.ilike.${p}`,
      `correo_solicitante.ilike.${p}`,
    ];
    if (ids.length) condiciones.push(`correo_id.in.(${ids.join(',')})`);
    query = query.or(condiciones.join(','));
  }

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  lanzarSiError(error, 'listar solicitudes');
  return { data: data || [], total: count ?? 0, page, limit };
}

export async function obtenerSolicitud(id) {
  validarId(id);
  const { data, error } = await db
    .from('solicitudes')
    .select('*, correos(*), correos_enviados(*)')
    .eq('id', id)
    .maybeSingle();
  lanzarSiError(error, 'consultar la solicitud');
  if (!data) throw new AppError(404, 'Solicitud no encontrada', 'NO_ENCONTRADO');

  const { correos, correos_enviados, ...solicitud } = data;
  return {
    ...solicitud,
    correo: correos,
    correos_enviados: (correos_enviados || []).sort((a, b) => (a.enviado_en < b.enviado_en ? 1 : -1)),
  };
}

export async function obtenerHistorial(id) {
  validarId(id);
  const { data: existe, error: e1 } = await db.from('solicitudes').select('id').eq('id', id).maybeSingle();
  lanzarSiError(e1, 'consultar la solicitud');
  if (!existe) throw new AppError(404, 'Solicitud no encontrada', 'NO_ENCONTRADO');

  const { data, error } = await db
    .from('historial_solicitudes')
    .select('*')
    .eq('solicitud_id', id)
    .order('created_at', { ascending: false });
  lanzarSiError(error, 'consultar el historial');
  return data || [];
}

// ---------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------
async function registrarHistorial({ solicitudId, accion, estadoAnterior, estadoNuevo, observaciones, user, detalle }) {
  const { error } = await db.from('historial_solicitudes').insert({
    solicitud_id: solicitudId,
    accion,
    estado_anterior: estadoAnterior ?? null,
    estado_nuevo: estadoNuevo ?? null,
    observaciones: observaciones || null,
    usuario_id: user.id,
    usuario_email: user.email,
    detalle: detalle || {},
  });
  lanzarSiError(error, 'registrar el historial');
}

async function cargarParaDecidir(id) {
  validarId(id);
  const { data, error } = await db
    .from('solicitudes')
    .select('*, correos(*)')
    .eq('id', id)
    .maybeSingle();
  lanzarSiError(error, 'consultar la solicitud');
  if (!data) throw new AppError(404, 'Solicitud no encontrada', 'NO_ENCONTRADO');
  if (ESTADOS_FINALES.includes(data.estado)) {
    throw new AppError(409, `La solicitud ya fue ${data.estado.toLowerCase()} y no admite más cambios`, 'ESTADO_FINAL');
  }
  return data;
}

async function aplicarCambio(solicitud, cambios, user) {
  const campos = { ...cambios };
  if (!solicitud.asignado_a) campos.asignado_a = user.id;

  const { data, error } = await db
    .from('solicitudes')
    .update(campos)
    .eq('id', solicitud.id)
    .in('estado', ESTADOS_ABIERTOS) // evita pisar una decisión concurrente
    .select('id')
    .maybeSingle();
  lanzarSiError(error, 'actualizar la solicitud');
  if (!data) {
    throw new AppError(409, 'La solicitud cambió mientras la editabas. Actualiza la vista.', 'CONFLICTO');
  }
}

function datosParaN8n(solicitud, user) {
  const correo = solicitud.correos;
  return {
    solicitud_id: solicitud.id,
    // El destinatario es SIEMPRE el remitente real del correo (no un dato extraído por IA).
    destinatario: correo.remitente_email,
    nombre_destinatario: solicitud.nombre_solicitante || correo.remitente_nombre || '',
    asunto_original: correo.asunto,
    gmail_message_id: correo.gmail_message_id,
    gmail_thread_id: correo.gmail_thread_id,
    nombre_proyecto: solicitud.nombre_proyecto || '',
    decidido_por: user.nombre || user.email,
  };
}

// ---------------------------------------------------------------------
// Cambio de estado: En revisión / Aprobada / Rechazada
// ---------------------------------------------------------------------
export async function cambiarEstado(id, { estado, observaciones, motivo }, user) {
  const permitidos = ['En revisión', 'Aprobada', 'Rechazada'];
  if (estado === 'Información requerida') {
    throw new AppError(400, 'Para solicitar información usa POST /api/solicitudes/:id/responder', 'VALIDACION');
  }
  if (!permitidos.includes(estado)) {
    throw new AppError(400, `Estado no permitido. Usa: ${permitidos.join(', ')}`, 'VALIDACION');
  }

  const obs = typeof observaciones === 'string' ? observaciones.trim().slice(0, 2000) : '';
  const mot = typeof motivo === 'string' ? motivo.trim().slice(0, 2000) : '';
  if (estado === 'Rechazada' && mot.length < 5) {
    throw new AppError(400, 'El motivo del rechazo es obligatorio (mínimo 5 caracteres)', 'VALIDACION');
  }

  const solicitud = await cargarParaDecidir(id);
  const anterior = solicitud.estado;

  // --- Solo marcar en revisión (no envía correo) ---
  if (estado === 'En revisión') {
    await aplicarCambio(solicitud, { estado }, user);
    await registrarHistorial({
      solicitudId: id, accion: 'Marcada en revisión', estadoAnterior: anterior,
      estadoNuevo: estado, observaciones: obs, user,
    });
    return obtenerSolicitud(id);
  }

  // --- Decisión final: primero n8n envía el correo real ---
  const accion = estado === 'Aprobada' ? 'aprobar' : 'rechazar';
  let respuesta;
  try {
    respuesta = await invocarWebhookRespuesta({
      ...datosParaN8n(solicitud, user),
      accion,
      observaciones: obs,
      motivo: mot,
    });
  } catch (e) {
    await registrarHistorial({
      solicitudId: id, accion: `Error al enviar correo (${accion})`, estadoAnterior: anterior,
      estadoNuevo: anterior, observaciones: e.message, user, detalle: { code: e.code },
    });
    throw e;
  }

  await aplicarCambio(
    solicitud,
    {
      estado,
      observaciones: obs || null,
      motivo_rechazo: estado === 'Rechazada' ? mot : null,
      decidido_por: user.id,
      decidido_en: new Date().toISOString(),
    },
    user,
  );
  await registrarHistorial({
    solicitudId: id,
    accion: estado === 'Aprobada' ? 'Solicitud aprobada' : 'Solicitud rechazada',
    estadoAnterior: anterior,
    estadoNuevo: estado,
    observaciones: estado === 'Rechazada' ? mot : obs,
    user,
    detalle: { gmail_message_id: respuesta.gmail_message_id ?? null },
  });
  return obtenerSolicitud(id);
}

// ---------------------------------------------------------------------
// Solicitar información adicional
// ---------------------------------------------------------------------
export async function solicitarInformacion(id, { mensaje, campos }, user) {
  const texto = typeof mensaje === 'string' ? mensaje.trim().slice(0, 4000) : '';
  if (texto.length < 10) {
    throw new AppError(400, 'Escribe un mensaje de al menos 10 caracteres para el solicitante', 'VALIDACION');
  }

  const solicitud = await cargarParaDecidir(id);
  const anterior = solicitud.estado;

  const lista = Array.isArray(campos) && campos.length ? campos : solicitud.campos_faltantes || [];
  const camposLimpios = lista.map((c) => String(c).trim().slice(0, 80)).filter(Boolean).slice(0, 30);

  let respuesta;
  try {
    respuesta = await invocarWebhookRespuesta({
      ...datosParaN8n(solicitud, user),
      accion: 'solicitar_informacion',
      mensaje: texto,
      campos_faltantes: camposLimpios,
    });
  } catch (e) {
    await registrarHistorial({
      solicitudId: id, accion: 'Error al enviar solicitud de información', estadoAnterior: anterior,
      estadoNuevo: anterior, observaciones: e.message, user, detalle: { code: e.code },
    });
    throw e;
  }

  await aplicarCambio(solicitud, { estado: 'Información requerida' }, user);
  await registrarHistorial({
    solicitudId: id,
    accion: 'Información adicional solicitada',
    estadoAnterior: anterior,
    estadoNuevo: 'Información requerida',
    observaciones: texto,
    user,
    detalle: { campos: camposLimpios, gmail_message_id: respuesta.gmail_message_id ?? null },
  });
  return obtenerSolicitud(id);
}
