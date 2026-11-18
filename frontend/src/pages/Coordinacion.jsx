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

const PESTANAS = [
  { id: 'todas', etiqueta: 'Todas', estado: '' },
  { id: 'pendientes', etiqueta: 'Pendientes', estado: 'pendientes' },
  { id: 'aprobadas', etiqueta: 'Aprobadas', estado: 'aprobadas' },
  { id: 'rechazadas', etiqueta: 'Rechazadas', estado: 'rechazadas' },
  { id: 'revision', etiqueta: 'Revisión manual', estado: 'revision' },
  { id: 'informacion', etiqueta: 'Información requerida', estado: 'informacion' },
  { id: 'error', etiqueta: 'Con error', estado: 'Error de procesamiento' },
];

const INICIAL = { page: 1, limit: 15, q: '', categoria: '', prioridad: '', desde: '', hasta: '', estado: '' };

export default function Coordinacion() {
  const [filtros, setFiltros] = useState(INICIAL);
  const [abierta, setAbierta] = useState(null);

  const cambiar = useCallback((parcial) => setFiltros((f) => ({ ...f, ...parcial, page: parcial.page ?? 1 })), []);
  const { data, total, cargando, error, recargar } = useListado(api.solicitudes, filtros);

  const pestana = PESTANAS.find((p) => p.estado === filtros.estado)?.id || 'todas';

  return (
    <>
      <header className="pagina__cabecera">
        <div>
          <span className="pagina__eyebrow">Gestión de solicitudes</span>
          <h1>Coordinación</h1>
          <p className="muted">Administra las solicitudes recibidas por correo</p>
        </div>
        <button type="button" className="btn btn--sec" onClick={recargar} disabled={cargando}>
          <IconRefresh className={cargando ? 'girar' : undefined} /> Actualizar
        </button>
      </header>

      <div className="pestanas" role="tablist">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className={`pestana${pestana === p.id ? ' pestana--activa' : ''}`} onClick={() => cambiar({ estado: p.estado })}>
            {p.etiqueta}
          </button>
        ))}
      </div>

      <FiltersBar filtros={filtros} onChange={cambiar} onLimpiar={() => setFiltros({ ...INICIAL, estado: filtros.estado })} />

      <section className="tarjeta tarjeta--tabla">
        {error && <ErrorBox mensaje={error} onReintentar={recargar} />}
        {!error && cargando && !data.length && <Cargando texto="Cargando solicitudes…" />}
        {!error && !cargando && !data.length && <Vacio titulo="No hay solicitudes con estos filtros" detalle="Prueba cambiando la pestaña o limpiando los filtros." />}

        {!error && data.length > 0 && (
          <div className={`tabla-contenedor${cargando ? ' tabla-contenedor--cargando' : ''}`}>
            <table className="tabla tabla--solicitudes">
              <thead>
                <tr>
                  <th>Solicitante</th><th>Asunto / Proyecto</th><th>Recibido</th><th>Categoría</th><th>Prioridad</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} tabIndex={0} onClick={() => setAbierta(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierta(s.id); }}>
                    <td><strong>{s.correos.remitente_nombre || '—'}</strong><div className="muted">{s.correos.remitente_email}</div></td>
                    <td><strong>{s.nombre_proyecto || s.correos.asunto}</strong>{s.nombre_proyecto && <div className="muted">{s.correos.asunto}</div>}</td>
                    <td className="nowrap">{fechaCorta(s.correos.fecha_recepcion)}</td>
                    <td><Badge valor={s.correos.categoria} /></td>
                    <td><Badge valor={s.correos.prioridad} /></td>
                    <td><Badge valor={s.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={filtros.page} limit={filtros.limit} total={total} onChange={(page) => cambiar({ page })} />
      </section>

      {abierta && <DetallePanel solicitudId={abierta} onClose={() => setAbierta(null)} onChanged={recargar} />}
    </>
  );
}
