import api from './index'

export const claysApi = {
  getAll(params = {}) {
    return api.get('/clays', { params })
  },

  getById(id) {
    return api.get(`/clays/${id}`)
  },

  create(data) {
    return api.post('/clays', data)
  },

  update(id, data) {
    return api.put(`/clays/${id}`, data)
  },

  delete(id) {
    return api.delete(`/clays/${id}`)
  }
}

export const glazesApi = {
  getAll(params = {}) {
    return api.get('/glazes', { params })
  },

  getById(id) {
    return api.get(`/glazes/${id}`)
  },

  create(data) {
    return api.post('/glazes', data)
  },

  update(id, data) {
    return api.put(`/glazes/${id}`, data)
  },

  delete(id) {
    return api.delete(`/glazes/${id}`)
  }
}
