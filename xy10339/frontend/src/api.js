import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export default {
  repairItems: {
    getAll: () => api.get('/repair-items'),
    getById: (id) => api.get(`/repair-items/${id}`),
    create: (data) => api.post('/repair-items', data),
    update: (id, data) => api.put(`/repair-items/${id}`, data),
    delete: (id) => api.delete(`/repair-items/${id}`)
  },
  buildings: {
    getAll: () => api.get('/buildings'),
    getById: (id) => api.get(`/buildings/${id}`),
    create: (data) => api.post('/buildings', data),
    addHouse: (id, data) => api.post(`/buildings/${id}/houses`, data),
    update: (id, data) => api.put(`/buildings/${id}`, data),
    delete: (id) => api.delete(`/buildings/${id}`)
  },
  owners: {
    getAll: () => api.get('/owners'),
    getById: (id) => api.get(`/owners/${id}`),
    create: (data) => api.post('/owners', data),
    update: (id, data) => api.put(`/owners/${id}`, data),
    delete: (id) => api.delete(`/owners/${id}`),
    searchByHouse: (buildingId, unitNumber, roomNumber) => 
      api.get('/owners/search/by-house', { params: { building_id: buildingId, unit_number: unitNumber, room_number: roomNumber } })
  },
  voting: {
    cast: (data) => api.post('/voting/cast', data),
    revoke: (id) => api.post(`/voting/${id}/revoke`),
    getByRepairItem: (repairItemId, params) => 
      api.get(`/voting/by-repair-item/${repairItemId}`, { params }),
    checkDuplicate: (repairItemId, houseId) => 
      api.get('/voting/check-duplicate', { params: { repair_item_id: repairItemId, house_id: houseId } }),
    getDisputes: (repairItemId) => api.get(`/voting/disputes/${repairItemId}`)
  },
  delegates: {
    getAll: (params) => api.get('/delegates', { params }),
    create: (data) => api.post('/delegates', data),
    revoke: (id) => api.post(`/delegates/${id}/revoke`),
    getByPrincipal: (ownerId, repairItemId) => 
      api.get(`/delegates/by-principal/${ownerId}`, { params: { repair_item_id: repairItemId } }),
    getByAgent: (ownerId, repairItemId) => 
      api.get(`/delegates/by-agent/${ownerId}`, { params: { repair_item_id: repairItemId } })
  },
  statistics: {
    getByRepairItem: (id) => api.get(`/statistics/repair-item/${id}`)
  }
}
