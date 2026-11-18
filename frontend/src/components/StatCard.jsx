export default function StatCard({ titulo, valor, detalle, icono: Icono, tono = 'neutro', cargando }) {
  return (
    <div className={`stat stat--${tono}`}>
      <div className="stat__cabecera">
        <span className="stat__titulo">{titulo}</span>
        {Icono && <span className="stat__icono"><Icono /></span>}
      </div>
      <div className="stat__valor">{cargando ? <span className="skeleton" /> : valor}</div>
      {detalle && <div className="stat__detalle">{detalle}</div>}
    </div>
  );
}
