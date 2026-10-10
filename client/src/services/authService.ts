import { API_URL } from '../utils/constants';

export const authService = {
  login: async (email: string, password: string): Promise<any> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  },

  demoLogin: async (email: string): Promise<any> => {
    const response = await fetch(`${API_URL}/api/auth/demo-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Demo login failed');
    }

    return response.json();
  },

  register: async (
    name: string,
    email: string,
    phone: string | null,
    password: string
  ): Promise<any> => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, phone, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Registration failed');
    }

    return response.json();
  },

  getCurrentUser: async (): Promise<any> => {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user;
  },

  logout: async (): Promise<void> => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};