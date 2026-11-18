export class AppError extends Error {
  constructor(status, message, code = 'ERROR', detalle = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.detalle = detalle;
  }
}

/** Evita try/catch repetidos en los controladores. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(req, res) {
  res.status(404).json({ ok: false, code: 'NO_ENCONTRADO', error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, code: err.code, error: err.message, detalle: err.detalle });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, code: 'JSON_INVALIDO', error: 'El cuerpo de la petición no es JSON válido' });
  }
  console.error('[error]', err);
  return res.status(500).json({ ok: false, code: 'ERROR_INTERNO', error: 'Error interno del servidor' });
}

/** Convierte un error de Supabase en AppError (sin filtrar detalles al cliente). */
export function lanzarSiError(error, contexto) {
  if (!error) return;
  console.error(`[supabase] ${contexto}:`, error);
  throw new AppError(500, `Error de base de datos al ${contexto}`, 'DB_ERROR');
}
