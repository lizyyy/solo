import type { User } from '../../shared/types.js';

const mockUsers: User[] = [
  {
    id: 'u001',
    username: 'zhangming',
    name: '张明',
    role: 'risk_officer',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

export const authService = {
  async login(username: string, password: string): Promise<User | null> {
    const user = mockUsers.find((u) => u.username === username);
    if (user && password === 'password') {
      return user;
    }
    return null;
  },

  async getCurrentUser(userId: string): Promise<User | null> {
    return mockUsers.find((u) => u.id === userId) || null;
  },
};
