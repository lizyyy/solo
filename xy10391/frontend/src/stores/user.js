import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import request from '@/utils/request';

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '');
  const userInfo = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isLoggedIn = computed(() => !!token.value);
  const role = computed(() => userInfo.value?.role || '');
  const roleName = computed(() => {
    const map = {
      admin: '管理员',
      manager: '经理',
      staff: '员工'
    };
    return map[role.value] || role.value;
  });

  async function login(username, password) {
    const data = await request.post('/auth/login', { username, password });
    token.value = data.token;
    userInfo.value = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }

  function logout() {
    token.value = '';
    userInfo.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function refreshProfile() {
    try {
      const data = await request.get('/auth/profile');
      userInfo.value = data;
      localStorage.setItem('user', JSON.stringify(data));
    } catch (error) {
      console.error('刷新用户信息失败', error);
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    role,
    roleName,
    login,
    logout,
    refreshProfile
  };
});
