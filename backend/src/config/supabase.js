import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente con privilegios totales (service_role). Solo backend. */
export const db = createClient(env.supabaseUrl, env.supabaseServiceKey, opciones);

/** Cliente anónimo: solo para validar credenciales de login. */
export const crearClienteAnon = () => createClient(env.supabaseUrl, env.supabaseAnonKey, opciones);
