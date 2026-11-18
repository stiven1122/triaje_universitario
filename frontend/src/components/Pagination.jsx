export default function Pagination({ page, limit, total, onChange }) {
  const paginas = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="paginacion">
      <span className="muted">Página {page} de {paginas} · {total} registros</span>
      <div className="paginacion__botones">
        <button type="button" className="btn btn--sec" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
        <button type="button" className="btn btn--sec" disabled={page >= paginas} onClick={() => onChange(page + 1)}>Siguiente</button>
      </div>
    </div>
  );
}
