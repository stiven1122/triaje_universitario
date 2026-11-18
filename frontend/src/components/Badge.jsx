import { slug } from '../services/format.js';

/** Etiqueta de color para categoría, prioridad o estado. */
export default function Badge({ valor, titulo }) {
  if (!valor) return <span className="muted">—</span>;
  return <span className={`badge b-${slug(valor)}`} title={titulo}>{valor}</span>;
}
