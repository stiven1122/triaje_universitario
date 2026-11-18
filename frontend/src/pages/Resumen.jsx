import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { CATEGORIAS, fechaHora, horas } from '../services/format.js';
import Badge from '../components/Badge.jsx';
import DetallePanel from '../components/DetallePanel.jsx';
import { Cargando, ErrorBox, Vacio } from '../components/Estados.jsx';
import { IconAlert, IconCheck, IconClock, IconFlag, IconInbox, IconRefresh, IconUsers } from '../components/Icons.jsx';
import StatCard from '../components/StatCard.jsx';

function ListaSolicitudes({ items, onAbrir, vacio }) {
  if (!items.length) return <Vacio titulo={vacio.titulo} detalle={vacio.detalle} />;
  return (
    <ul className="lista-items">
      {items.map((s) => (
        <li key={s.id}>
          <button type="button" className="item" onClick={() => onAbrir(s.id)}>
            <div className="item__principal">
              <strong>{s.nombre_proyecto || s.correos.asunto}</strong>
              <span className="muted">{s.correos.remitente_nombre || s.correos.remitente_email} · {fechaHora(s.correos.fecha_recepcion)}</span>
            </div>
            <div className="item__etiquetas">
              <Badge valor={s.correos.categoria} />
              <Badge valor={s.correos.prioridad} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Resumen() {
  const [stats, setStats] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [urgentes, setUrgentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [e, p, u] = await Promise.all([
        api.estadisticas(),
        api.solicitudes({ estado: 'pendientes', limit: 6 }),
        api.solicitudes({ estado: 'pendientes', urgentes: 'true', limit: 5 }),
      ]);
      setStats(e.data);
      setPendientes(p.data);
      setUrgentes(u.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const porCategoria = stats?.por_categoria || {};
  const maxCategoria = Math.max(1, ...CATEGORIAS.map((c) => Number(porCategoria[c] || 0)));
  const primeraCarga = cargando && !stats;

  return (
    <>
      <header className="pagina__cabecera">
        <div>
          <h1>Resumen</h1>
          <p className="muted">Estado actual de los correos y solicitudes recibidos</p>
        </div>
        <button type="button" className="btn btn--sec" onClick={cargar} disabled={cargando}>
          <IconRefresh className={cargando ? 'girar' : undefined} /> {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </header>

      {error && <ErrorBox mensaje={error} onReintentar={cargar} />}

      {!error && primeraCarga && <Cargando texto="Cargando estadísticas…" />}

      {!error && stats && (
        <>
          <section className="stats" aria-label="Indicadores">
            <StatCard titulo="Total de correos" valor={stats.total_correos} icono={IconInbox} />
            <StatCard titulo="Correos urgentes" valor={stats.correos_urgentes} icono={IconAlert} tono="peligro" detalle="Categoría urgente o prioridad crítica" />
            <StatCard titulo="Prioridad alta" valor={stats.prioridad_alta} icono={IconFlag} tono="aviso" />
            <StatCard titulo="Pendientes de decisión" valor={stats.pendientes_decision} icono={IconClock} tono="info" detalle={[stats.revision_manual ? `${stats.revision_manual} en revisión manual` : '', stats.info_requerida ? `${stats.info_requerida} esperando información` : ''].filter(Boolean).join(' · ') || undefined} />
            <StatCard titulo="Tiempo promedio de respuesta" valor={horas(stats.tiempo_promedio_respuesta_horas)} icono={IconClock} detalle="Desde la recepción hasta la decisión" />
            <StatCard titulo="Tasa de resolución" valor={`${Number(stats.tasa_resolucion).toFixed(1)}%`} icono={IconCheck} tono="ok" detalle={`${stats.resueltas} de ${stats.total_solicitudes} solicitudes`} />
            <StatCard titulo="Solicitudes asignadas" valor={stats.solicitudes_asignadas} icono={IconUsers} />
          </section>

          <div className="rejilla">
            <section className="tarjeta rejilla__ancha">
              <header className="tarjeta__cabecera">
                <h2>Solicitudes por decidir</h2>
                <Link to="/coordinacion" className="enlace">Ver todas</Link>
              </header>
              <ListaSolicitudes items={pendientes} onAbrir={setAbierta} vacio={{ titulo: 'Sin solicitudes pendientes', detalle: 'Cuando llegue una nueva solicitud aparecerá aquí.' }} />
            </section>

            <section className="tarjeta">
              <header className="tarjeta__cabecera"><h2>Por categoría</h2></header>
              <ul className="barras">
                {CATEGORIAS.map((c) => {
                  const n = Number(porCategoria[c] || 0);
                  return (
                    <li key={c}>
                      <div className="barras__fila"><Badge valor={c} /><strong>{n}</strong></div>
                      <div className="barras__pista"><div className={`barras__relleno b-${c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}`} style={{ width: `${(n / maxCategoria) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="tarjeta rejilla__ancha">
              <header className="tarjeta__cabecera"><h2>Urgentes por atender</h2></header>
              <ListaSolicitudes items={urgentes} onAbrir={setAbierta} vacio={{ titulo: 'Nada urgente por atender', detalle: 'No hay solicitudes críticas o urgentes pendientes.' }} />
            </section>

            <section className="tarjeta tarjeta--cta">
              <h2>Panel del coordinador</h2>
              <p className="muted">Gestiona todas las solicitudes: filtra, revisa los detalles y aprueba, rechaza o pide información.</p>
              <Link to="/coordinacion" className="btn btn--primario">Ir a Coordinación</Link>
            </section>
          </div>
        </>
      )}

      {abierta && <DetallePanel solicitudId={abierta} onClose={() => setAbierta(null)} onChanged={cargar} />}
    </>
  );
}
