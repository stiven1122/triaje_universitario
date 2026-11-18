const ZONA = 'America/Bogota';

export function fechaHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function soloFecha(valor) {
  if (!valor) return '—';
  // fecha_realizacion llega como AAAA-MM-DD: se interpreta sin desfase horario
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { timeZone: m ? 'UTC' : ZONA, day: '2-digit', month: 'long', year: 'numeric' });
}

export function pesos(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

export function horas(valor) {
  if (valor === null || valor === undefined) return 'Sin datos';
  const h = Number(valor);
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h >= 48) return `${(h / 24).toFixed(1)} días`;
  return `${h.toFixed(1)} h`;
}

export const slug = (t) =>
  String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const CATEGORIAS = ['Urgente', 'Académico', 'Administrativo', 'Promociones', 'Otros'];
export const PRIORIDADES = ['Crítica', 'Alta', 'Media', 'Baja'];
export const ESTADOS_FINALES = ['Aprobada', 'Rechazada'];
