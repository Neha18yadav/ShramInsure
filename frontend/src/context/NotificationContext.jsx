// context/NotificationContext.jsx — Modern global notification manager
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notifications as notifApi } from '../utils/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notifApi.list();
      if (data.success) {
        setNotifications(data.notifications.map(n => ({
          ...n,
          read: !!n.read,
          time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
      }
    } catch (err) {
      console.error('[NotificationContext] Fetch error:', err);
    }
  }, []);

  // Poll for new notifications every 30s
  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await notifApi.markRead(id);
    } catch (err) {
      console.error('[NotificationContext] MarkRead error:', err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notifApi.readAll();
    } catch (err) {
      console.error('[NotificationContext] MarkAllRead error:', err);
    }
  };

  const removeNotification = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await notifApi.delete(id);
    } catch (err) {
      console.error('[NotificationContext] Remove error:', err);
    }
  };

  // Exposed method for legacy or specific triggers
  const addNotification = (notif) => {
    fetchNotifications();
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead, 
      removeNotification,
      refresh: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
