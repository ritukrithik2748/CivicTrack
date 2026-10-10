import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface AuthContextType {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: 'citizen' | 'officer' | 'admin';
    department_id: string | null;
    verified: number;
    department_name?: string;
  } | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: (email: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string | null,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<
    | {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: 'citizen' | 'officer' | 'admin';
        department_id: string | null;
        verified: number;
        department_name?: string;
      }
    | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to get current user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    login: async (email, password) => {
      const userData = await authService.login(email, password);
      setUser(userData);
      navigate('/');
    },
    demoLogin: async (email) => {
      const userData = await authService.demoLogin(email);
      setUser(userData);
      navigate('/');
    },
    register: async (name, email, phone, password) => {
      const userData = await authService.register(name, email, phone, password);
      setUser(userData);
      navigate('/');
    },
    logout: async () => {
      await authService.logout();
      setUser(null);
      navigate('/login');
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Alias for backward compatibility
export const HuskyProvider = AuthProvider;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};