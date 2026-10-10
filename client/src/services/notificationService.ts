import { API_URL } from '../utils/constants';

export const notificationService = {
  getNotifications: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/api/notifications`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }

    return response.json();
  },

  markAsRead: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to mark notification as read');
    }
  },

  markAllAsRead: async (): Promise<void> => {
    const response = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to mark all notifications as read');
    }
  },
};