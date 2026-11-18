import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { IconEye, IconEyeOff } from '../components/Icons.jsx';

export default function Login() {
  const { usuario, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={location.state?.desde || '/'} replace />;

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login__tarjeta">
        <aside className="login__marca">
          <div className="login__logo">
            <img src="/brand/logo-uniautonoma.png" alt="Uniautónoma del Cauca" />
          </div>

          <div className="login__mensaje">
            <h2>Gestión de solicitudes institucionales</h2>
            <p>Clasifica, revisa y responde los correos que llegan a la coordinación con el apoyo del triaje automático.</p>
          </div>

          <img className="login__mascota" src="/brand/mascota-uniautonoma.png" alt="" aria-hidden="true" />

          <p className="login__leyenda">Universidad Autónoma del Cauca · Vigilado Mineducación</p>
        </aside>

        <form className="login__formulario" onSubmit={enviar}>
          <span className="pagina__eyebrow">Sistema de triaje</span>
          <h1>Iniciar sesión</h1>
          <p className="muted">Ingresa con tu cuenta institucional de coordinación.</p>

          <label className="campo campo--bloque">
            <span>Correo electrónico</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </label>

          <label className="campo campo--bloque">
            <span>Contraseña</span>
            <span className="campo__ojo">
              <input
                type={verClave ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="ojo"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verClave ? <IconEyeOff /> : <IconEye />}
              </button>
            </span>
          </label>

          {error && <div className="alerta alerta--error" role="alert">{error}</div>}

          <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="login__pie">Uso exclusivo del personal de coordinación.</p>
        </form>
      </div>
    </div>
  );
}
