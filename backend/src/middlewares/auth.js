import { db } from '../config/supabase.js';
import { AppError, asyncHandler } from './errorHandler.js';

/**
 * Protege rutas administrativas:
 *  1) exige "Authorization: Bearer <access_token de Supabase Auth>"
 *  2) valida el token con Supabase
 *  3) comprueba que el usuario exista y esté activo en la tabla "usuarios"
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new AppError(401, 'Falta el token de autenticación', 'NO_AUTENTICADO');
  }

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) {
    throw new AppError(401, 'Sesión inválida o expirada', 'TOKEN_INVALIDO');
  }

  const { data: perfil, error: errPerfil } = await db
    .from('usuarios')
    .select('id, email, nombre, rol, activo')
    .eq('id', data.user.id)
    .maybeSingle();

  if (errPerfil) throw new AppError(500, 'No se pudo verificar el usuario', 'DB_ERROR');
  if (!perfil || !perfil.activo) {
    throw new AppError(403, 'Tu usuario no tiene acceso al panel', 'SIN_PERMISO');
  }

  req.user = perfil;
  next();
});
