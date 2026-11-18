import { useState } from 'react';
import Modal from './Modal.jsx';

const TEXTOS = {
  aprobar: {
    titulo: 'Aprobar solicitud',
    etiqueta: 'Observaciones (opcional)',
    ayuda: 'Se enviará un correo de aprobación al solicitante. Las observaciones se incluirán en el mensaje.',
    boton: 'Confirmar aprobación',
    clase: 'btn--ok',
  },
  rechazar: {
    titulo: 'Rechazar solicitud',
    etiqueta: 'Motivo del rechazo (obligatorio)',
    ayuda: 'Se enviará un correo de rechazo con este motivo al solicitante.',
    boton: 'Confirmar rechazo',
    clase: 'btn--peligro',
  },
  info: {
    titulo: 'Solicitar información adicional',
    etiqueta: 'Mensaje para el solicitante',
    ayuda: 'Se enviará un correo pidiendo la información. La solicitud quedará en estado "Información requerida".',
    boton: 'Enviar solicitud',
    clase: 'btn--primario',
  },
};

export default function DecisionModal({ modo, solicitud, onClose, onConfirm }) {
  const t = TEXTOS[modo];
  const faltantes = solicitud.campos_faltantes || [];
  const [texto, setTexto] = useState(
    modo === 'info' ? 'Para continuar con la revisión de su solicitud, por favor envíenos la información indicada.' : '',
  );
  const [seleccion, setSeleccion] = useState(new Set(faltantes));
  const [extra, setExtra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const alternar = (campo) => setSeleccion((s) => {
    const n = new Set(s);
    if (n.has(campo)) n.delete(campo); else n.add(campo);
    return n;
  });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    const limpio = texto.trim();

    if (modo === 'rechazar' && limpio.length < 5) return setError('El motivo del rechazo es obligatorio (mínimo 5 caracteres).');
    if (modo === 'info' && limpio.length < 10) return setError('Escribe un mensaje de al menos 10 caracteres.');

    let payload;
    if (modo === 'aprobar') payload = { estado: 'Aprobada', observaciones: limpio };
    else if (modo === 'rechazar') payload = { estado: 'Rechazada', motivo: limpio };
    else {
      const adicionales = extra.split(',').map((c) => c.trim()).filter(Boolean);
      payload = { mensaje: limpio, campos: [...seleccion, ...adicionales] };
    }

    setEnviando(true);
    try {
      await onConfirm(payload);
      onClose();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={t.titulo} onClose={onClose} bloqueado={enviando}>
      <form onSubmit={enviar} className="form">
        <p className="muted">{t.ayuda}</p>
        <p className="destinatario">Destinatario: <strong>{solicitud.correo?.remitente_email}</strong></p>

        {modo === 'info' && (
          <fieldset className="campos-falt">
            <legend>Información que se solicita</legend>
            {faltantes.length === 0 && <p className="muted">No se detectaron campos faltantes; puedes añadir los tuyos abajo.</p>}
            {faltantes.map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={seleccion.has(c)} onChange={() => alternar(c)} />
                <span>{c}</span>
              </label>
            ))}
            <label className="campo campo--bloque">
              <span>Otros datos (separados por coma)</span>
              <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ej.: Carta del docente, Cronograma" />
            </label>
          </fieldset>
        )}

        <label className="campo campo--bloque">
          <span>{t.etiqueta}</span>
          <textarea rows={modo === 'info' ? 4 : 5} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus maxLength={2000} />
        </label>

        {error && <div className="alerta alerta--error" role="alert">{error}</div>}

        <div className="modal__pie">
          <button type="button" className="btn btn--sec" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="submit" className={`btn ${t.clase}`} disabled={enviando}>
            {enviando ? 'Enviando correo…' : t.boton}
          </button>
        </div>
      </form>
    </Modal>
  );
}
