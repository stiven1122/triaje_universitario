import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { IconCorreos } from '../components/Icons.jsx';

export default function Login() {
  const { usuario, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <form className="login__tarjeta" onSubmit={enviar}>
        <span className="logo logo--grande"><IconCorreos width={26} height={26} /></span>
        <h1>Triaje de correos</h1>
        <p className="muted">Ingresa con tu cuenta de coordinación</p>

        <label className="campo campo--bloque">
          <span>Correo electrónico</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="campo campo--bloque">
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && <div className="alerta alerta--error" role="alert">{error}</div>}

        <button type="submit" className="btn btn--primario btn--bloque" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
