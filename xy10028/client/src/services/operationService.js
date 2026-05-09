import api from '../utils/api';

const operationService = {
  async getOperations(params) {
    const response = await api.get('/operations', { params });
    return response.data;
  },

  async getInventoryOperations(inventoryId, params = {}) {
    const response = await api.get(`/operations/inventory/${inventoryId}`, { params });
    return response.data;
  },

  async getOperationById(id) {
    const response = await api.get(`/operations/${id}`);
    return response.data;
  },

  async replayOperation(id) {
    const response = await api.get(`/operations/${id}/replay`);
    return response.data;
  },

  async getTransfers(params = {}) {
    const response = await api.get('/operations/transfers', { params });
    return response.data;
  },

  async getPriceChanges(params = {}) {
    const response = await api.get('/operations/price-changes', { params });
    return response.data;
  }
};

export default operationService;
