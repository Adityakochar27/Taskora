import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { notificationService } from '../services/index';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);
const POLL_MS = 30_000;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationService.list({ limit: 30 });
      setItems(res.data || []);
      setUnread(res.unread || 0);
    } catch {
      /* swallow — already toasted */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]); setUnread(0);
      return;
    }
    refresh();
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [user, refresh]);

  const markRead = async (id) => {
    await notificationService.markRead(id);
    setItems((cur) => cur.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await notificationService.markAllRead();
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <NotificationContext.Provider
      value={{ items, unread, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
