import { create } from 'zustand';
import { User, AuthResponse } from '../types';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  init: () => void;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  init: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ token, user, isAuthenticated: true });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  },

  register: async (username, email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        username,
        email,
        password,
        displayName,
      });

      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));

      set({
        token: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '注册失败',
        loading: false,
      });
      throw error;
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        username,
        password,
      });

      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));

      set({
        token: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || '登录失败',
        loading: false,
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
