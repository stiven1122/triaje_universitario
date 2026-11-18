import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga un listado paginado desde la API y expone loading / error / recargar.
 * Descarta respuestas obsoletas si cambian los filtros mientras se carga.
 */
export function useListado(fetcher, params) {
  const [estado, setEstado] = useState({ data: [], total: 0, cargando: true, error: null });
  const secuencia = useRef(0);
  const clave = JSON.stringify(params);

  const cargar = useCallback(async () => {
    const id = ++secuencia.current;
    setEstado((s) => ({ ...s, cargando: true, error: null }));
    try {
      const r = await fetcher(JSON.parse(clave));
      if (id === secuencia.current) setEstado({ data: r.data, total: r.total, cargando: false, error: null });
    } catch (e) {
      if (id === secuencia.current) setEstado((s) => ({ ...s, cargando: false, error: e.message }));
    }
  }, [fetcher, clave]);

  useEffect(() => { cargar(); }, [cargar]);

  return { ...estado, recargar: cargar };
}
