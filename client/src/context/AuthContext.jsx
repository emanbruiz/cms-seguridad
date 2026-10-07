import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mfa, setMfa] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then((data) => {
        setUser(data.user);
        setMfa(Boolean(data.mfa));
      })
      .catch(() => {
        setUser(null);
        setMfa(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (data.mfaRequired) return { mfaRequired: true };
    setUser(data.user);
    setMfa(false);
    return { mfaRequired: false };
  };

  const verifyMfa = async (code) => {
    const data = await api('/auth/mfa/verify', { method: 'POST', body: { code } });
    setUser(data.user);
    setMfa(true);
  };

  const register = async (name, email, password) => {
    await api('/auth/register', { method: 'POST', body: { name, email, password } });
    await login(email, password);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setMfa(false);
  };

  const refresh = async () => {
    const data = await api('/auth/me');
    setUser(data.user);
    setMfa(Boolean(data.mfa));
  };

  return (
    <AuthContext.Provider value={{ user, mfa, loading, login, verifyMfa, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);