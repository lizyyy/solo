import api from '../utils/api';

const authService = {
  async login(username, password) {
    const response = await api.post('/auth/login', { username, password });
    const result = response.data;
    
    if (result.success) {
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }
    
    return result;
  },

  async register(data) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  }
};

export default authService;
