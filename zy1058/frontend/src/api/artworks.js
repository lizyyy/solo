import api from './index'

export const artworksApi = {
  getAll(params = {}) {
    return api.get('/artworks', { params })
  },

  getById(id) {
    return api.get(`/artworks/${id}`)
  },

  create(data) {
    return api.post('/artworks', data)
  },

  update(id, data) {
    return api.put(`/artworks/${id}`, data)
  },

  delete(id) {
    return api.delete(`/artworks/${id}`)
  },

  updateStatus(id, toStatus, notes = '') {
    return api.patch(`/artworks/${id}/status`, { to_status: toStatus, notes })
  },

  getHistory(id) {
    return api.get(`/artworks/${id}/history`)
  },

  batchUpdateStatus(artworkIds, toStatus, notes = '') {
    return api.post('/artworks/batch/status', {
      artwork_ids: artworkIds,
      to_status: toStatus,
      notes
    })
  }
}
