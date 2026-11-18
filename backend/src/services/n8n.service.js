import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Invoca el webhook del workflow 2 (Respuestas administrativas) de n8n.
 * n8n envía el correo por Gmail y responde { ok: true, gmail_message_id, ... }.
 * Si n8n falla o no responde, se lanza un AppError y NO se cambia el estado.
 */
export async function invocarWebhookRespuesta(payload) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), env.n8nTimeoutMs);

  try {
    const res = await fetch(env.n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': env.n8nWebhookSecret,
      },
      body: JSON.stringify(payload),
      signal: controlador.signal,
    });

    const texto = await res.text();
    let datos;
    try {
      datos = texto ? JSON.parse(texto) : {};
    } catch {
      datos = { raw: texto.slice(0, 300) };
    }

    if (!res.ok || datos.ok === false) {
      throw new AppError(
        502,
        datos.error || `n8n respondió con estado ${res.status}. Revisa que el workflow esté activo.`,
        'N8N_ERROR',
      );
    }
    return datos;
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e.name === 'AbortError') {
      throw new AppError(504, 'n8n tardó demasiado en responder', 'N8N_TIMEOUT');
    }
    console.error('[n8n]', e);
    throw new AppError(502, 'No se pudo contactar con n8n. ¿Está en ejecución y la URL es correcta?', 'N8N_INACCESIBLE');
  } finally {
    clearTimeout(temporizador);
  }
}
