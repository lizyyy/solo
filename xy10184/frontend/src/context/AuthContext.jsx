import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';
import { message } from 'antd';

const AuthContext = createContext();

const ROLE_NAMES = {
  admin: '系统管理员',
  reviewer: '复核员',
  operator: '操作员'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const { data } = await authApi.login({ username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      message.success('登录成功');
      return true;
    } catch (err) {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    message.success('已退出登录');
  }, []);

  const hasRole = useCallback((...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const isAdmin = useCallback(() => hasRole('admin'), [hasRole]);
  const isReviewer = useCallback(() => hasRole('reviewer', 'admin'), [hasRole]);
  const isOperator = useCallback(() => hasRole('operator', 'admin'), [hasRole]);

  const getRoleName = useCallback((role) => {
    return ROLE_NAMES[role] || role;
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    hasRole,
    isAdmin,
    isReviewer,
    isOperator,
    getRoleName
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
