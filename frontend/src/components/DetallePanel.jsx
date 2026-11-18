import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { ESTADOS_FINALES, fechaHora, pesos, soloFecha } from '../services/format.js';
import { useToast } from '../hooks/useToast.jsx';
import Badge from './Badge.jsx';
import DecisionModal from './DecisionModal.jsx';
import { Cargando, ErrorBox } from './Estados.jsx';
import { IconClose } from './Icons.jsx';

function Dato({ etiqueta, children, ancho }) {
  const vacio = children === null || children === undefined || children === '' || children === '—';
  return (
    <div className={`dato${ancho ? ' dato--ancho' : ''}`}>
      <dt>{etiqueta}</dt>
      <dd className={vacio ? 'faltante' : undefined}>{vacio ? 'No indicado' : children}</dd>
    </div>
  );
}

/**
 * Vista detallada de un correo/solicitud.
 * Recibe solicitudId (desde Coordinación/Resumen) o correoId (desde Correos).
 */
export default function DetallePanel({ solicitudId, correoId, onClose, onChanged }) {
  const toast = useToast();
  const [correo, setCorreo] = useState(null);
  const [sol, setSol] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const cargarHistorial = useCallback(async (id) => {
    try { setHistorial((await api.historial(id)).data); } catch { /* no bloquea la vista */ }
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      let s = null;
      let c = null;
      if (solicitudId) {
        s = (await api.solicitud(solicitudId)).data;
        c = s.correo;
      } else {
        c = (await api.correo(correoId)).data;
        if (c.solicitud?.id) {
          s = (await api.solicitud(c.solicitud.id)).data;
          c = s.correo;
        }
      }
      setCorreo(c);
      setSol(s);
      if (s) cargarHistorial(s.id); else setHistorial([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [solicitudId, correoId, cargarHistorial]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !modo) onClose(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onClose, modo]);

  function aplicar(respuesta) {
    setSol(respuesta.data);
    setCorreo(respuesta.data.correo);
    cargarHistorial(respuesta.data.id);
    toast.exito(respuesta.mensaje);
    onChanged?.();
  }

  async function ejecutar(modoAccion, payload) {
    const r = modoAccion === 'info' ? await api.responder(sol.id, payload) : await api.cambiarEstado(sol.id, payload);
    aplicar(r);
  }

  async function marcarRevision() {
    setProcesando(true);
    try {
      aplicar(await api.cambiarEstado(sol.id, { estado: 'En revisión' }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesando(false);
    }
  }

  const final = sol && ESTADOS_FINALES.includes(sol.estado);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !modo) onClose(); }}>
      <aside className="panel" role="dialog" aria-modal="true" aria-label="Detalle de la solicitud">
        <header className="panel__cabecera">
          <div>
            <h2>{correo?.asunto || 'Detalle'}</h2>
            {correo && <p className="muted">{correo.remitente_nombre || correo.remitente_email} · {fechaHora(correo.fecha_recepcion)}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar detalle"><IconClose /></button>
        </header>

        <div className="panel__cuerpo">
          {cargando && <Cargando texto="Cargando detalle…" />}
          {!cargando && error && <ErrorBox mensaje={error} onReintentar={cargar} />}

          {!cargando && !error && correo && (
            <>
              <div className="chips">
                <Badge valor={correo.categoria} />
                <Badge valor={correo.prioridad} />
                <Badge valor={sol ? sol.estado : 'Sin solicitud'} />
                {correo.estado_procesamiento === 'Error de procesamiento' && <Badge valor="Error de procesamiento" titulo={correo.error_detalle} />}
              </div>

              {correo.error_detalle && (
                <div className={`alerta ${correo.estado_procesamiento === 'Error de procesamiento' ? 'alerta--error' : 'alerta--info'}`}>
                  <strong>{correo.estado_procesamiento === 'Error de procesamiento' ? 'Error de procesamiento automático: ' : 'Aviso del análisis: '}</strong>
                  {correo.error_detalle}. Revisa el contenido original y decide manualmente.
                </div>
              )}

              {sol && (
                <div className="acciones">
                  <button type="button" className="btn btn--ok" disabled={final || procesando} onClick={() => setModo('aprobar')}>Aprobar</button>
                  <button type="button" className="btn btn--peligro" disabled={final || procesando} onClick={() => setModo('rechazar')}>Rechazar</button>
                  <button type="button" className="btn btn--primario" disabled={final || procesando} onClick={() => setModo('info')}>Solicitar información</button>
                  <button type="button" className="btn btn--sec" disabled={final || procesando || sol.estado === 'En revisión'} onClick={marcarRevision}>
                    {procesando ? 'Guardando…' : 'Marcar en revisión'}
                  </button>
                  {final && <span className="muted">Decisión final registrada; no admite más cambios.</span>}
                </div>
              )}

              {!sol && (
                <div className="alerta alerta--info">
                  {correo.decision_triaje === 'Descartado'
                    ? 'Este correo fue descartado automáticamente por las reglas de triaje. No se envió ninguna respuesta al remitente.'
                    : 'Este correo no requiere una decisión del coordinador (no se generó solicitud).'}
                </div>
              )}

              {sol?.estado === 'Revisión manual' && (
                <div className="alerta alerta--info">
                  <strong>Revisión manual: </strong>las reglas no pudieron decidir este caso. Revisa el contenido y marca la solicitud como se requiera, o pide más información al remitente.
                </div>
              )}

              {correo.decision_triaje && (
                <section className="bloque">
                  <h3>Triaje automático</h3>
                  <dl className="datos">
                    <Dato etiqueta="Rol del remitente">{correo.rol_remitente}</Dato>
                    <Dato etiqueta="Tipo de correo">{correo.tipo_correo}</Dato>
                    <Dato etiqueta="Decisión">{correo.decision_triaje}</Dato>
                    <Dato etiqueta="Motivo" ancho>{correo.motivo_triaje}</Dato>
                  </dl>
                </section>
              )}

              <section className="bloque">
                <h3>Correo recibido</h3>
                <dl className="datos">
                  <Dato etiqueta="Remitente">{correo.remitente_nombre}</Dato>
                  <Dato etiqueta="Correo electrónico">{correo.remitente_email}</Dato>
                  <Dato etiqueta="Fecha de recepción">{fechaHora(correo.fecha_recepcion)}</Dato>
                  {correo.resumen && <Dato etiqueta="Resumen de la IA" ancho>{correo.resumen}</Dato>}
                </dl>
                <h4>Contenido original</h4>
                <pre className="correo-texto">{correo.cuerpo || '(sin contenido)'}</pre>
              </section>

              {sol && (
                <>
                  <section className="bloque">
                    <h3>Datos extraídos por n8n</h3>
                    <dl className="datos">
                      <Dato etiqueta="Nombre del proyecto">{sol.nombre_proyecto}</Dato>
                      <Dato etiqueta="Tipo de proyecto">{sol.tipo_proyecto}</Dato>
                      <Dato etiqueta="Solicitante">{sol.nombre_solicitante}</Dato>
                      <Dato etiqueta="Correo del solicitante">{sol.correo_solicitante}</Dato>
                      <Dato etiqueta="Presupuesto">{sol.presupuesto === null ? null : pesos(sol.presupuesto)}</Dato>
                      <Dato etiqueta="Cantidad de estudiantes">{sol.cantidad_estudiantes === null ? null : String(sol.cantidad_estudiantes)}</Dato>
                      <Dato etiqueta="Fecha propuesta">{sol.fecha_realizacion ? soloFecha(sol.fecha_realizacion) : null}</Dato>
                      <Dato etiqueta="Destino">{sol.destino}</Dato>
                      <Dato etiqueta="Descripción de la solicitud" ancho>{sol.descripcion}</Dato>
                      <Dato etiqueta="Justificación" ancho>{sol.justificacion}</Dato>
                      <Dato etiqueta="Objetivos" ancho>
                        {sol.objetivos?.length ? <ul className="lista">{sol.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ul> : null}
                      </Dato>
                      <Dato etiqueta="Documentos adjuntos" ancho>
                        {sol.documentos_adjuntos?.length ? <ul className="lista">{sol.documentos_adjuntos.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}
                      </Dato>
                      <Dato etiqueta="Información adicional" ancho>{sol.informacion_adicional}</Dato>
                    </dl>

                    <h4>Información faltante</h4>
                    {sol.campos_faltantes?.length
                      ? <div className="chips">{sol.campos_faltantes.map((c) => <span key={c} className="badge b-faltante">{c}</span>)}</div>
                      : <p className="muted">No se detectaron campos faltantes.</p>}
                  </section>

                  {(sol.observaciones || sol.motivo_rechazo) && (
                    <section className="bloque">
                      <h3>Decisión</h3>
                      <dl className="datos">
                        {sol.motivo_rechazo && <Dato etiqueta="Motivo del rechazo" ancho>{sol.motivo_rechazo}</Dato>}
                        {sol.observaciones && <Dato etiqueta="Observaciones" ancho>{sol.observaciones}</Dato>}
                        <Dato etiqueta="Fecha de decisión">{sol.decidido_en ? fechaHora(sol.decidido_en) : null}</Dato>
                      </dl>
                    </section>
                  )}

                  <section className="bloque">
                    <h3>Correos enviados</h3>
                    {sol.correos_enviados?.length ? (
                      <ul className="linea">
                        {sol.correos_enviados.map((m) => (
                          <li key={m.id}>
                            <div><strong>{m.tipo}</strong> a {m.destinatario} <span className={`badge ${m.estado_envio === 'Enviado' ? 'b-aprobada' : 'b-rechazada'}`}>{m.estado_envio}</span></div>
                            <small className="muted">{fechaHora(m.enviado_en)}{m.error_detalle ? ` · ${m.error_detalle}` : ''}</small>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">Aún no se ha enviado ninguna respuesta.</p>}
                  </section>

                  <section className="bloque">
                    <h3>Historial de decisiones</h3>
                    {historial.length ? (
                      <ul className="linea">
                        {historial.map((h) => (
                          <li key={h.id}>
                            <div><strong>{h.accion}</strong>{h.estado_nuevo && h.estado_nuevo !== h.estado_anterior ? <> · {h.estado_anterior} → {h.estado_nuevo}</> : null}</div>
                            {h.observaciones && <div>{h.observaciones}</div>}
                            <small className="muted">{h.usuario_email || 'Sistema'} · {fechaHora(h.created_at)}</small>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">Sin movimientos registrados.</p>}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {modo && sol && (
        <DecisionModal
          modo={modo}
          solicitud={{ ...sol, correo }}
          onClose={() => setModo(null)}
          onConfirm={(payload) => ejecutar(modo, payload)}
        />
      )}
    </div>
  );
}
