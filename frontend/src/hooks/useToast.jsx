import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let contador = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const quitar = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const mostrar = useCallback((tipo, mensaje) => {
    const id = ++contador;
    setToasts((t) => [...t, { id, tipo, mensaje }]);
    setTimeout(() => quitar(id), tipo === 'error' ? 7000 : 4500);
  }, [quitar]);

  const api = useMemo(() => ({
    exito: (m) => mostrar('exito', m),
    error: (m) => mostrar('error', m),
    info: (m) => mostrar('info', m),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tipo}`}>
            <span>{t.mensaje}</span>
            <button type="button" aria-label="Cerrar" onClick={() => quitar(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
