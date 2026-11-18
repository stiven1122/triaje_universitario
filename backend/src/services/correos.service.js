import { db } from '../config/supabase.js';
import { AppError, lanzarSiError } from '../middlewares/errorHandler.js';
import {
  CATEGORIAS,
  PRIORIDADES,
  esUuid,
  finDeDia,
  limpiarBusqueda,
  paginar,
  parsearEstados,
  unico,
  validarEnum,
  validarFecha,
} from '../utils.js';

/** IDs de correos cuyo proyecto (en la solicitud) coincide con la búsqueda. */
export async function correoIdsPorProyecto(texto) {
  const { data, error } = await db
    .from('solicitudes')
    .select('correo_id')
    .or(`nombre_proyecto.ilike.%${texto}%,nombre_solicitante.ilike.%${texto}%`)
    .limit(500);
  lanzarSiError(error, 'buscar por proyecto');
  return (data || []).map((r) => r.correo_id);
}

function normalizar(correo) {
  const { solicitudes, ...resto } = correo;
  return { ...resto, solicitud: unico(solicitudes) };
}

export async function listarCorreos(filtros) {
  const { page, limit, from, to } = paginar(filtros);
  const categoria = validarEnum(filtros.categoria, CATEGORIAS, 'categoria');
  const prioridad = validarEnum(filtros.prioridad, PRIORIDADES, 'prioridad');
  // "descartado" no tiene solicitud: se filtra por la decisión del triaje
  const soloDescartados = String(filtros.estado || '').toLowerCase() === 'descartado';
  const estados = soloDescartados ? null : parsearEstados(filtros.estado);
  const desde = validarFecha(filtros.desde, 'desde');
  const hasta = validarFecha(filtros.hasta, 'hasta');
  const texto = limpiarBusqueda(filtros.q);

  const relacion = estados ? 'solicitudes!inner' : 'solicitudes';
  let query = db
    .from('correos')
    .select(
      `id, gmail_message_id, remitente_nombre, remitente_email, asunto, fecha_recepcion,
       categoria, prioridad, resumen, requiere_decision, estado_procesamiento,
       rol_remitente, tipo_correo, decision_triaje, motivo_triaje,
       ${relacion}(id, estado, nombre_proyecto, asignado_a)`,
      { count: 'exact' },
    );

  if (categoria) query = query.eq('categoria', categoria);
  if (prioridad) query = query.eq('prioridad', prioridad);
  if (estados) query = query.in('solicitudes.estado', estados);
  if (soloDescartados) query = query.eq('decision_triaje', 'Descartado');
  if (desde) query = query.gte('fecha_recepcion', desde.toISOString());
  if (hasta) query = query.lte('fecha_recepcion', finDeDia(hasta));
  if (String(filtros.urgentes) === 'true') query = query.or('categoria.eq.Urgente,prioridad.eq.Crítica');

  if (texto) {
    const ids = await correoIdsPorProyecto(texto);
    const condiciones = [
      `remitente_nombre.ilike.%${texto}%`,
      `remitente_email.ilike.%${texto}%`,
      `asunto.ilike.%${texto}%`,
    ];
    if (ids.length) condiciones.push(`id.in.(${ids.join(',')})`);
    query = query.or(condiciones.join(','));
  }

  const { data, error, count } = await query.order('fecha_recepcion', { ascending: false }).range(from, to);
  lanzarSiError(error, 'listar correos');

  return { data: (data || []).map(normalizar), total: count ?? 0, page, limit };
}

export async function obtenerCorreo(id) {
  if (!esUuid(id)) throw new AppError(400, 'El id del correo no es válido', 'VALIDACION');

  const { data, error } = await db
    .from('correos')
    .select('*, solicitudes(*)')
    .eq('id', id)
    .maybeSingle();
  lanzarSiError(error, 'consultar el correo');
  if (!data) throw new AppError(404, 'Correo no encontrado', 'NO_ENCONTRADO');
  return normalizar(data);
}

export async function obtenerEstadisticas() {
  const { data, error } = await db.rpc('obtener_estadisticas');
  lanzarSiError(error, 'calcular estadísticas');
  return data;
}
