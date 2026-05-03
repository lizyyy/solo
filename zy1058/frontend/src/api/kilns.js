import api from './index'

export const kilnsApi = {
  getAll(params = {}) {
    return api.get('/kilns', { params })
  },

  getById(id) {
    return api.get(`/kilns/${id}`)
  },

  create(data) {
    return api.post('/kilns', data)
  },

  update(id, data) {
    return api.put(`/kilns/${id}`, data)
  },

  delete(id) {
    return api.delete(`/kilns/${id}`)
  },

  getShelves(kilnId) {
    return api.get(`/kilns/${kilnId}/shelves`)
  }
}

export const shelvesApi = {
  getAll(kilnId) {
    return api.get(`/shelves`, { params: { kiln_id: kilnId } })
  },

  getById(id) {
    return api.get(`/shelves/${id}`)
  },

  create(data) {
    return api.post('/shelves', data)
  },

  update(id, data) {
    return api.put(`/shelves/${id}`, data)
  },

  delete(id) {
    return api.delete(`/shelves/${id}`)
  }
}

export const firingCurvesApi = {
  getAll(params = {}) {
    return api.get('/firing-curves', { params })
  },

  getById(id) {
    return api.get(`/firing-curves/${id}`)
  },

  create(data) {
    return api.post('/firing-curves', data)
  },

  update(id, data) {
    return api.put(`/firing-curves/${id}`, data)
  },

  delete(id) {
    return api.delete(`/firing-curves/${id}`)
  }
}
