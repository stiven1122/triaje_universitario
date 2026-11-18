import { useCallback, useState } from 'react';
import { api } from '../services/api.js';
import { fechaCorta } from '../services/format.js';
import { useListado } from '../hooks/useListado.js';
import Badge from '../components/Badge.jsx';
import DetallePanel from '../components/DetallePanel.jsx';
import { Cargando, ErrorBox, Vacio } from '../components/Estados.jsx';
import FiltersBar from '../components/FiltersBar.jsx';
import Pagination from '../components/Pagination.jsx';
import { IconRefresh } from '../components/Icons.jsx';

const ESTADOS = [
  { valor: 'pendientes', etiqueta: 'Pendientes' },
  { valor: 'aprobadas', etiqueta: 'Aprobadas' },
  { valor: 'rechazadas', etiqueta: 'Rechazadas' },
  { valor: 'informacion', etiqueta: 'Información requerida' },
  { valor: 'revision', etiqueta: 'Revisión manual' },
  { valor: 'descartado', etiqueta: 'Descartados (sin respuesta)' },
  { valor: 'Error de procesamiento', etiqueta: 'Error de procesamiento' },
];

const INICIAL = { page: 1, limit: 15, q: '', categoria: '', prioridad: '', desde: '', hasta: '', estado: '' };

export default function Correos() {
  const [filtros, setFiltros] = useState(INICIAL);
  const [abierto, setAbierto] = useState(null);

  const cambiar = useCallback((parcial) => setFiltros((f) => ({ ...f, ...parcial, page: parcial.page ?? 1 })), []);
  const { data, total, cargando, error, recargar } = useListado(api.correos, filtros);

  return (
    <>
      <header className="pagina__cabecera">
        <div>
          <span className="pagina__eyebrow">Bandeja institucional</span>
          <h1>Correos</h1>
          <p className="muted">Todos los mensajes recibidos y clasificados por n8n</p>
        </div>
        <button type="button" className="btn btn--sec" onClick={recargar} disabled={cargando}>
          <IconRefresh className={cargando ? 'girar' : undefined} /> Actualizar
        </button>
      </header>

      <FiltersBar filtros={filtros} onChange={cambiar} onLimpiar={() => setFiltros(INICIAL)} estados={ESTADOS} />

      <section className="tarjeta tarjeta--tabla">
        {error && <ErrorBox mensaje={error} onReintentar={recargar} />}
        {!error && cargando && !data.length && <Cargando texto="Cargando correos…" />}
        {!error && !cargando && !data.length && <Vacio titulo="No hay correos para mostrar" detalle="Cuando n8n procese mensajes nuevos aparecerán aquí." />}

        {!error && data.length > 0 && (
          <div className={`tabla-contenedor${cargando ? ' tabla-contenedor--cargando' : ''}`}>
            <table className="tabla tabla--correos">
              <thead>
                <tr>
                  <th>Remitente</th><th>Asunto</th><th>Recepción</th><th>Categoría</th><th>Prioridad</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} tabIndex={0} onClick={() => setAbierto(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierto(c.id); }}>
                    <td><strong>{c.remitente_nombre || '—'}</strong><div className="muted">{c.remitente_email}</div></td>
                    <td>
                      <strong>{c.asunto}</strong>
                      <div className="muted">{c.rol_remitente ? `${c.rol_remitente} · ${c.tipo_correo || '—'}` : '—'}</div>
                    </td>
                    <td className="nowrap">{fechaCorta(c.fecha_recepcion)}</td>
                    <td><Badge valor={c.categoria} /></td>
                    <td><Badge valor={c.prioridad} /></td>
                    <td><Badge valor={c.solicitud ? c.solicitud.estado : (c.decision_triaje === 'Descartado' ? 'Descartado' : 'Sin solicitud')} titulo={c.motivo_triaje || undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={filtros.page} limit={filtros.limit} total={total} onChange={(page) => cambiar({ page })} />
      </section>

      {abierto && <DetallePanel correoId={abierto} onClose={() => setAbierto(null)} onChanged={recargar} />}
    </>
  );
}
