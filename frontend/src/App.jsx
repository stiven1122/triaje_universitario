import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import { Cargando } from './components/Estados.jsx';
import Coordinacion from './pages/Coordinacion.jsx';
import Correos from './pages/Correos.jsx';
import Login from './pages/Login.jsx';
import Resumen from './pages/Resumen.jsx';

function Protegida({ children }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  if (cargando) return <div className="pantalla-completa"><Cargando texto="Verificando sesión…" /></div>;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Resumen />} />
        <Route path="coordinacion" element={<Coordinacion />} />
        <Route path="correos" element={<Correos />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
