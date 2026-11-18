import { crearClienteAnon, db } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new AppError(400, 'Correo y contraseña son obligatorios', 'VALIDACION');
  }

  const { data, error } = await crearClienteAnon().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data?.session) {
    throw new AppError(401, 'Credenciales incorrectas', 'CREDENCIALES');
  }

  const { data: perfil, error: errPerfil } = await db
    .from('usuarios')
    .select('id, email, nombre, rol, activo')
    .eq('id', data.user.id)
    .maybeSingle();
  if (errPerfil) throw new AppError(500, 'No se pudo verificar el usuario', 'DB_ERROR');
  if (!perfil || !perfil.activo) {
    throw new AppError(403, 'Tu usuario no tiene acceso al panel. Pide al administrador que te habilite.', 'SIN_PERMISO');
  }

  res.json({
    ok: true,
    token: data.session.access_token,
    expira_en: data.session.expires_at,
    usuario: { id: perfil.id, email: perfil.email, nombre: perfil.nombre, rol: perfil.rol },
  });
}

export function me(req, res) {
  const { id, email, nombre, rol } = req.user;
  res.json({ ok: true, usuario: { id, email, nombre, rol } });
}
