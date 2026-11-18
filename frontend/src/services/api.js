// Cliente de la API REST. Solo habla con el backend; nunca con Supabase ni n8n.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'triaje_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* almacenamiento no disponible */ }
};

export class ApiError extends Error {
  constructor(message, status = 0, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function armarUrl(path, params) {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const texto = qs.toString();
  return `${BASE}${path}${texto ? `?${texto}` : ''}`;
}

async function request(path, { method = 'GET', body, params, publica = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token && !publica) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(armarUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.', 0, 'RED');
  }

  let datos = null;
  try { datos = await res.json(); } catch { /* respuesta sin JSON */ }

  if (!res.ok) {
    if (res.status === 401 && !publica) {
      setToken(null);
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new ApiError(datos?.error || `Error ${res.status} del servidor`, res.status, datos?.code);
  }
  return datos;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, publica: true }),
  me: () => request('/auth/me'),

  estadisticas: () => request('/correos/estadisticas'),
  correos: (params) => request('/correos', { params }),
  correo: (id) => request(`/correos/${id}`),

  solicitudes: (params) => request('/solicitudes', { params }),
  solicitud: (id) => request(`/solicitudes/${id}`),
  historial: (id) => request(`/solicitudes/${id}/historial`),
  cambiarEstado: (id, body) => request(`/solicitudes/${id}/estado`, { method: 'PATCH', body }),
  responder: (id, body) => request(`/solicitudes/${id}/responder`, { method: 'POST', body }),
};
