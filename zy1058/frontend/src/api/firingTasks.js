import api from './index'

export const firingTasksApi = {
  getAll(params = {}) {
    return api.get('/firing-tasks', { params })
  },

  getById(id) {
    return api.get(`/firing-tasks/${id}`)
  },

  create(data) {
    return api.post('/firing-tasks', data)
  },

  update(id, data) {
    return api.put(`/firing-tasks/${id}`, data)
  },

  delete(id) {
    return api.delete(`/firing-tasks/${id}`)
  },

  updateStatus(id, status, notes = '') {
    return api.patch(`/firing-tasks/${id}/status`, { status, notes })
  },

  getArtworks(id) {
    return api.get(`/firing-tasks/${id}/artworks`)
  },

  addArtwork(id, data) {
    return api.post(`/firing-tasks/${id}/add-artwork`, data)
  },

  removeArtwork(id, artworkId) {
    return api.post(`/firing-tasks/${id}/remove-artwork`, { artwork_id: artworkId })
  },

  validate(id) {
    return api.get(`/firing-tasks/${id}/validate`)
  },

  getHistory(id) {
    return api.get(`/firing-tasks/${id}/history`)
  },

  exportReport(id, format = 'markdown') {
    return api.get(`/firing-tasks/${id}/export/${format}`, {
      responseType: 'blob'
    })
  }
}
