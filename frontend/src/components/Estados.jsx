import { IconAlert, IconInbox } from './Icons.jsx';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="estado" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function ErrorBox({ mensaje, onReintentar }) {
  return (
    <div className="estado estado--error" role="alert">
      <IconAlert width={22} height={22} />
      <p>{mensaje || 'Ocurrió un error inesperado.'}</p>
      {onReintentar && <button type="button" className="btn btn--sec" onClick={onReintentar}>Reintentar</button>}
    </div>
  );
}

export function Vacio({ titulo = 'Sin resultados', detalle }) {
  return (
    <div className="estado">
      <IconInbox width={26} height={26} />
      <strong>{titulo}</strong>
      {detalle && <p className="muted">{detalle}</p>}
    </div>
  );
}
