import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const MOCK_USERS: Record<string, { user: User; password: string }> = {
  'admin@example.com': {
    user: {
      id: 'mock-admin-id',
      email: 'admin@example.com',
      name: '系统管理员',
      role: 'admin',
    },
    password: 'password123',
  },
  'agent1@example.com': {
    user: {
      id: 'mock-agent1-id',
      email: 'agent1@example.com',
      name: '客服专员-张三',
      role: 'agent',
    },
    password: 'password123',
  },
  'agent2@example.com': {
    user: {
      id: 'mock-agent2-id',
      email: 'agent2@example.com',
      name: '客服专员-李四',
      role: 'agent',
    },
    password: 'password123',
  },
};

const generateMockToken = (userId: string) => {
  return `mock-jwt-token-${userId}-${Date.now()}`;
};

export const useAuthStore = create<AuthStore>((set) => {
  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('auth_token');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,

    login: async (email: string, password: string) => {
      const mockUser = MOCK_USERS[email];
      if (!mockUser || mockUser.password !== password) {
        throw new Error('用户名或密码错误');
      }

      const token = generateMockToken(mockUser.user.id);

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(mockUser.user));

      set({
        user: mockUser.user,
        token,
        isAuthenticated: true,
      });
    },

    logout: () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    },

    setUser: (user) => {
      set({ user });
    },
  };
});