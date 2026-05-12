import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const ordersAPI = {
  getOrders: (filters) => api.get('/orders', { params: filters }),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (data) => api.post('/orders', data),
  confirmOrder: (id) => api.post(`/orders/${id}/confirm`),
  dispatchOrder: (id, coolerId) => api.post(`/orders/${id}/dispatch`, { cooler_id: coolerId }),
  signOrder: (id, signedBy) => api.post(`/orders/${id}/sign`, { signed_by: signedBy }),
  refundOrder: (id, reason) => api.post(`/orders/${id}/refund`, { reason }),
  checkCapacity: (data) => api.post('/orders/check-capacity', data)
}

export const customersAPI = {
  getCustomers: () => api.get('/customers'),
  getCustomer: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  getBilling: (id, startDate, endDate) => api.get(`/customers/${id}/billing`, {
    params: { start_date: startDate, end_date: endDate }
  })
}

export const commonAPI = {
  getIceSpecs: () => api.get('/ice-specs'),
  getDeliverySlots: (date) => api.get('/delivery-slots', { params: { date } }),
  getCoolers: (status) => api.get('/coolers', { params: { status } }),
  returnCooler: (id, notes) => api.post(`/coolers/${id}/return`, { notes }),
  getCapacityAlerts: () => api.get('/capacity-alerts'),
  exportOrders: (filters) => api.get('/export-orders', { params: filters })
}

export default api
