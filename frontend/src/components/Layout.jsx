import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { IconCoordinacion, IconCorreos, IconLogout, IconResumen } from './Icons.jsx';

const ITEMS = [
  { to: '/', etiqueta: 'Resumen', icono: IconResumen, fin: true },
  { to: '/coordinacion', etiqueta: 'Coordinación', icono: IconCoordinacion },
  { to: '/correos', etiqueta: 'Correos', icono: IconCorreos },
];

export default function Layout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__marca">
          <span className="logo"><IconCorreos /></span>
          <div>
            <strong>Triaje</strong>
            <small>Correos universitarios</small>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Principal">
          {ITEMS.map(({ to, etiqueta, icono: Icono, fin }) => (
            <NavLink key={to} to={to} end={fin} className={({ isActive }) => `nav-item${isActive ? ' nav-item--activo' : ''}`}>
              <Icono />
              <span>{etiqueta}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__usuario">
          <div className="avatar" aria-hidden="true">{(usuario?.nombre || usuario?.email || '?').charAt(0).toUpperCase()}</div>
          <div className="sidebar__datos">
            <strong>{usuario?.nombre}</strong>
            <small>{usuario?.rol === 'admin' ? 'Administrador' : 'Coordinador'}</small>
          </div>
          <button type="button" className="icon-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <IconLogout />
          </button>
        </div>
      </aside>

      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
