import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api';
import type { User } from '@/types';
import { ElMessage } from 'element-plus';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);

  const isLoggedIn = computed(() => !!token.value);
  const role = computed(() => user.value?.role);

  const hasRole = (roles: string[]) => {
    if (!user.value) return false;
    return roles.includes(user.value.role);
  };

  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isManager = computed(() => isAdmin.value || user.value?.role === 'MANAGER');

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const data = response.data as any;

    token.value = data.accessToken;
    user.value = data.user;

    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    ElMessage.success('登录成功');
    return data;
  };

  const fetchProfile = async () => {
    if (!token.value) return;

    try {
      const response = await authApi.getProfile();
      user.value = response.data as User;
      localStorage.setItem('user', JSON.stringify(user.value));
    } catch (error) {
      logout();
    }
  };

  const logout = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const initFromStorage = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch {
        user.value = null;
      }
    }
  };

  return {
    token,
    user,
    isLoggedIn,
    role,
    isAdmin,
    isManager,
    hasRole,
    login,
    fetchProfile,
    logout,
    initFromStorage,
  };
});
