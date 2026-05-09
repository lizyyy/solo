import api from '../utils/api';

const dashboardService = {
  async getStats(storeId) {
    const response = await api.get('/dashboard/stats', { params: { storeId } });
    return response.data;
  },

  async getRecentOperations(limit = 10) {
    const response = await api.get('/dashboard/recent-operations', { params: { limit } });
    return response.data;
  },

  async getLowStockAlerts(storeId, limit = 20) {
    const response = await api.get('/dashboard/low-stock-alerts', { 
      params: { storeId, limit } 
    });
    return response.data;
  }
};

export default dashboardService;
