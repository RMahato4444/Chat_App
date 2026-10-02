import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('glasschat_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('glasschat_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    setAuthToken(token);
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ data }) => { setUser(data.user); localStorage.setItem('glasschat_user', JSON.stringify(data.user)); })
      .catch(() => { localStorage.removeItem('glasschat_token'); localStorage.removeItem('glasschat_user'); setToken(null); setUser(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('glasschat_token', data.token);
    localStorage.setItem('glasschat_user', JSON.stringify(data.user));
    setToken(data.token); setUser(data.user); setAuthToken(data.token);
  };

  const signup = async (credentials) => {
    const { data } = await api.post('/auth/signup', credentials);
    localStorage.setItem('glasschat_token', data.token);
    localStorage.setItem('glasschat_user', JSON.stringify(data.user));
    setToken(data.token); setUser(data.user); setAuthToken(data.token);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('glasschat_user', JSON.stringify(nextUser));
  };

  const logout = () => {
    localStorage.removeItem('glasschat_token');
    localStorage.removeItem('glasschat_user');
    setToken(null); setUser(null); setAuthToken(null);
  };

  const value = useMemo(() => ({ token, user, loading, login, signup, updateUser, logout }), [token, user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
