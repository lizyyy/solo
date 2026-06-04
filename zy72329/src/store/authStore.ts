import { create } from 'zustand';
import type { User, UserRole } from '../../shared/types';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  quickLogin: (role: UserRole) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  initialize: () => void;
}

const roleCredentials: Record<UserRole, { username: string; password: string }> = {
  admin: { username: 'admin', password: 'admin123' },
  coach: { username: 'coach', password: 'coach123' },
  reviewer: { username: 'reviewer', password: 'reviewer123' },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  initialize: () => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser) as User;
        set({ user, token: storedToken, isAuthenticated: true });
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
      }
    }
  },

  login: async (username: string, password: string) => {
    const response = await api.login(username, password);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },

  quickLogin: async (role: UserRole) => {
    const cred = roleCredentials[role];
    const response = await api.login(cred.username, cred.password);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  setUser: (user: User | null) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
    }
    set({ user });
  },
}));
