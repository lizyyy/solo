import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthToken, AuthState } from '@/types';
import apiClient from '@/api/client';

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setTokens: (tokens: AuthToken) => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

interface AuthStore extends AuthState, AuthActions {}

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (username: string, password: string) => {
        const response = await apiClient.post<{ user: User; tokens: AuthToken }>('/auth/login', {
          username,
          password,
        });

        set({
          user: response.user,
          tokens: response.tokens,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set(initialState);
        localStorage.removeItem('auth-storage');
      },

      setTokens: (tokens: AuthToken) => {
        set({ tokens });
      },

      setUser: (user: User) => {
        set({ user });
      },

      refreshUser: async () => {
        const { tokens } = get();
        if (!tokens) return;

        try {
          const user = await apiClient.get<User>('/auth/me');
          set({ user });
        } catch (error) {
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
