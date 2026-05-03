import api from './index'

export const customersApi = {
  getAll(params = {}) {
    return api.get('/customers', { params })
  },

  getById(id) {
    return api.get(`/customers/${id}`)
  },

  create(data) {
    return api.post('/customers', data)
  },

  update(id, data) {
    return api.put(`/customers/${id}`, data)
  },

  delete(id) {
    return api.delete(`/customers/${id}`)
  }
}
