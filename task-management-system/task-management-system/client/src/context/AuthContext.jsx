import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { initPushNotifications } from '../services/fcmService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tf_user') || 'null');
    } catch {
      return null;
    }
  });
  const [booting, setBooting] = useState(true);

  // Validate stored token on boot.
  useEffect(() => {
    const token = localStorage.getItem('tf_token');
    if (!token) {
      setBooting(false);
      return;
    }
    authService
      .me()
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('tf_user', JSON.stringify(data.user));
      })
      .catch(() => {
        localStorage.removeItem('tf_token');
        localStorage.removeItem('tf_user');
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  // Once authenticated, init push.
  useEffect(() => {
    if (user) initPushNotifications();
  }, [user]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await authService.signup(payload);
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    const fcm = localStorage.getItem('tf_fcm_token');
    if (fcm) authService.removeFcm(fcm).catch(() => {});
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    localStorage.removeItem('tf_fcm_token');
    setUser(null);
  }, []);

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, booting, login, signup, logout, hasRole, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
