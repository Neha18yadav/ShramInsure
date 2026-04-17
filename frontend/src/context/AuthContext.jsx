// context/AuthContext.jsx — Global auth state
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token  = localStorage.getItem('si_token');
    const stored = localStorage.getItem('si_user');
    if (token && stored) {
      try { setUser(JSON.parse(stored)); } catch {}
      auth.me()
        .then(r => {
          setUser(r.user);
          localStorage.setItem('si_user', JSON.stringify(r.user));
        })
        .catch(() => { localStorage.removeItem('si_token'); localStorage.removeItem('si_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('si_token', token);
    localStorage.setItem('si_user',  JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('si_token');
    localStorage.removeItem('si_user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const r = await auth.me();
      setUser(r.user);
      localStorage.setItem('si_user', JSON.stringify(r.user));
      return r.user;
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
