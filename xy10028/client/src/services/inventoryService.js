import api, { generateRequestId } from '../utils/api';

const inventoryService = {
  async getInventory(params = {}) {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  async getInventoryById(id) {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  async createInventory(data) {
    const requestId = generateRequestId();
    const response = await api.post('/inventory', data, {
      headers: { 'X-Request-ID': requestId }
    });
    return response.data;
  },

  async adjustInventory(id, adjustment) {
    const requestId = generateRequestId();
    const response = await api.post(`/inventory/${id}/adjust`, adjustment, {
      headers: { 'X-Request-ID': requestId }
    });
    return response.data;
  },

  async updatePrice(id, price, reason) {
    const requestId = generateRequestId();
    const response = await api.post(`/inventory/${id}/price`, { price, reason }, {
      headers: { 'X-Request-ID': requestId }
    });
    return response.data;
  },

  async transferStock(data) {
    const requestId = generateRequestId();
    const response = await api.post('/inventory/transfer', data, {
      headers: { 'X-Request-ID': requestId }
    });
    return response.data;
  },

  async getSnapshots(id, params = {}) {
    const response = await api.get(`/inventory/${id}/snapshots`, { params });
    return response.data;
  }
};

export default inventoryService;
