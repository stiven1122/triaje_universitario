import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then((r) => setUsuario(r.usuario))
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const alExpirar = () => { setToken(null); setUsuario(null); };
    window.addEventListener('auth:logout', alExpirar);
    return () => window.removeEventListener('auth:logout', alExpirar);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password);
    setToken(r.token);
    setUsuario(r.usuario);
  }, []);

  const logout = useCallback(() => { setToken(null); setUsuario(null); }, []);

  const valor = useMemo(() => ({ usuario, cargando, login, logout }), [usuario, cargando, login, logout]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
