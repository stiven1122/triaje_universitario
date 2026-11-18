import { AppError } from './middlewares/errorHandler.js';

export const ESTADOS = [
  'Pendiente',
  'En revisión',
  'Revisión manual',
  'Aprobada',
  'Rechazada',
  'Información requerida',
  'Error de procesamiento',
];
export const CATEGORIAS = ['Urgente', 'Académico', 'Administrativo', 'Promociones', 'Otros'];
export const PRIORIDADES = ['Crítica', 'Alta', 'Media', 'Baja'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** Limpia texto de búsqueda para usarlo dentro de filtros .or() de PostgREST. */
export function limpiarBusqueda(texto) {
  if (!texto) return '';
  return String(texto).replace(/[,()%*\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Convierte alias de estado en una lista de estados válidos. */
export function parsearEstados(valor) {
  if (!valor) return null;
  const alias = {
    pendientes: ['Pendiente', 'En revisión', 'Revisión manual'],
    revision: ['Revisión manual'],
    aprobadas: ['Aprobada'],
    rechazadas: ['Rechazada'],
    informacion: ['Información requerida'],
  };
  const lista = String(valor)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => alias[s.toLowerCase()] || [s]);
  const invalidos = lista.filter((s) => !ESTADOS.includes(s));
  if (invalidos.length) {
    throw new AppError(400, `Estado no válido: ${invalidos.join(', ')}`, 'VALIDACION');
  }
  return lista.length ? [...new Set(lista)] : null;
}

export function validarEnum(valor, permitidos, nombre) {
  if (valor === undefined || valor === '') return null;
  if (!permitidos.includes(valor)) {
    throw new AppError(400, `${nombre} no válido. Permitidos: ${permitidos.join(', ')}`, 'VALIDACION');
  }
  return valor;
}

export function validarFecha(valor, nombre) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, `${nombre} no es una fecha válida (usa AAAA-MM-DD)`, 'VALIDACION');
  }
  return d;
}

export function paginar(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

/** PostgREST devuelve objeto o arreglo según la relación; unifica a objeto/null. */
export const unico = (rel) => (Array.isArray(rel) ? rel[0] ?? null : rel ?? null);

export function finDeDia(fecha) {
  const d = new Date(fecha);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}
