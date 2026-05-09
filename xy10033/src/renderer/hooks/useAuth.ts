import { useState, useEffect } from 'react';
import { User, UserRole } from '../../shared/types';

interface AuthState {
  user: Omit<User, 'password'> | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await window.electronAPI.auth.getCurrentUser();
      if (result.success) {
        setUser(result.user);
      }
    } catch (error) {
      console.error('Check auth failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const result = await window.electronAPI.auth.login(username, password);
    if (result.success) {
      setUser(result.user);
      return true;
    }
    return false;
  };

  const logout = async (): Promise<void> => {
    await window.electronAPI.auth.logout();
    setUser(null);
  };

  return { user, isLoading, login, logout };
}

export function hasPermission(user: Omit<User, 'password'> | null, permission: string): boolean {
  if (!user) return false;
  
  const permissions: Record<string, string[]> = {
    [UserRole.ADMIN]: [
      'order.create',
      'order.read',
      'order.update',
      'order.delete',
      'order.export',
      'order.import',
      'order.batch_update',
      'user.create',
      'user.read',
      'user.update',
      'user.delete',
      'log.read',
      'system.recover',
      'system.config'
    ],
    [UserRole.CUSTOMER_SERVICE]: [
      'order.create',
      'order.read',
      'order.update',
      'order.export',
      'order.import',
      'order.batch_update',
      'log.read'
    ],
    [UserRole.NORMAL]: [
      'order.read',
      'order.export'
    ]
  };

  const userPermissions = permissions[user.role] || [];
  return userPermissions.includes(permission);
}
