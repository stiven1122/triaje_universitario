import 'dotenv/config';

const requeridas = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_SECRET',
];

const faltantes = requeridas.filter((k) => !process.env[k]);
if (faltantes.length) {
  console.error(`[config] Faltan variables de entorno: ${faltantes.join(', ')}`);
  console.error('[config] Copia .env.example a .env y complétalo.');
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET,
  n8nTimeoutMs: Number(process.env.N8N_TIMEOUT_MS) || 30000,
};
