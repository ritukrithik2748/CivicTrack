import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

interface NotificationContextType {
  notifications: Array<any>;
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Don't fetch notifications if auth is still loading or user is not authenticated
    if (authLoading || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const loadNotifications = async () => {
      try {
        const data = await notificationService.getNotifications();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };

    loadNotifications();

    // Set up polling for new notifications (every 30 seconds)
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, authLoading]);

  const notify = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'info':
        toast.info(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
    }
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    notify,
    markAsRead: async (id) => {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    },
    markAllAsRead: async () => {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    },
    fetchNotifications: async () => {
      try {
        const data = await notificationService.getNotifications();
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    },
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};