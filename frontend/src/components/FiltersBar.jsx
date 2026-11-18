import { useEffect, useState } from 'react';
import { CATEGORIAS, PRIORIDADES } from '../services/format.js';
import { IconSearch } from './Icons.jsx';

/** Barra de filtros compartida por Coordinación y Correos. */
export default function FiltersBar({ filtros, onChange, onLimpiar, estados }) {
  const [q, setQ] = useState(filtros.q || '');

  // Búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => { if (q !== (filtros.q || '')) onChange({ q }); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { setQ(filtros.q || ''); }, [filtros.q]);

  return (
    <div className="filtros">
      <label className="campo campo--buscar">
        <span className="sr-only">Buscar</span>
        <IconSearch />
        <input
          type="search"
          placeholder="Buscar por remitente, asunto o proyecto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <label className="campo">
        <span>Categoría</span>
        <select value={filtros.categoria || ''} onChange={(e) => onChange({ categoria: e.target.value })}>
          <option value="">Todas</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>

      <label className="campo">
        <span>Prioridad</span>
        <select value={filtros.prioridad || ''} onChange={(e) => onChange({ prioridad: e.target.value })}>
          <option value="">Todas</option>
          {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>

      {estados && (
        <label className="campo">
          <span>Estado</span>
          <select value={filtros.estado || ''} onChange={(e) => onChange({ estado: e.target.value })}>
            <option value="">Todos</option>
            {estados.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
        </label>
      )}

      <label className="campo">
        <span>Desde</span>
        <input type="date" value={filtros.desde || ''} max={filtros.hasta || undefined} onChange={(e) => onChange({ desde: e.target.value })} />
      </label>

      <label className="campo">
        <span>Hasta</span>
        <input type="date" value={filtros.hasta || ''} min={filtros.desde || undefined} onChange={(e) => onChange({ hasta: e.target.value })} />
      </label>

      <button type="button" className="btn btn--sec" onClick={onLimpiar}>Limpiar</button>
    </div>
  );
}
