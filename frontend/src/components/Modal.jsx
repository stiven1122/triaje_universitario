import { useEffect } from 'react';
import { IconClose } from './Icons.jsx';

export default function Modal({ titulo, onClose, children, ancho = 520, bloqueado = false }) {
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !bloqueado) onClose(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onClose, bloqueado]);

  return (
    <div className="overlay overlay--modal" onMouseDown={(e) => { if (e.target === e.currentTarget && !bloqueado) onClose(); }}>
      <div className="modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal__cabecera">
          <h3>{titulo}</h3>
          <button type="button" className="icon-btn" onClick={onClose} disabled={bloqueado} aria-label="Cerrar"><IconClose /></button>
        </header>
        <div className="modal__cuerpo">{children}</div>
      </div>
    </div>
  );
}
