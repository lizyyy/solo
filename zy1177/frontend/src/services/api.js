import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default {
  async getMaps() {
    const response = await apiClient.get('/maps')
    return response.data
  },

  async getMap(mapId) {
    const response = await apiClient.get(`/maps/${mapId}`)
    return response.data
  },

  async getRobots(warehouseMapId = null) {
    const params = {}
    if (warehouseMapId) params.warehouse_map_id = warehouseMapId
    const response = await apiClient.get('/robots', { params })
    return response.data
  },

  async getOrders(warehouseMapId = null, status = null) {
    const params = {}
    if (warehouseMapId) params.warehouse_map_id = warehouseMapId
    if (status) params.status = status
    const response = await apiClient.get('/orders', { params })
    return response.data
  },

  async createBatch(warehouseMapId, name, description = '', algorithm = 'greedy') {
    const response = await apiClient.post('/scheduling/batches', null, {
      params: { warehouse_map_id: warehouseMapId, name, description, algorithm }
    })
    return response.data
  },

  async runScheduling(batchId) {
    const response = await apiClient.post(`/scheduling/batches/${batchId}/run`)
    return response.data
  },

  async getBatches(warehouseMapId = null, status = null) {
    const params = {}
    if (warehouseMapId) params.warehouse_map_id = warehouseMapId
    if (status) params.status = status
    const response = await apiClient.get('/scheduling/batches', { params })
    return response.data
  },

  async generateFrames(batchId, timeStep = 0.5) {
    const response = await apiClient.post(`/scheduling/batches/${batchId}/generate-frames`, null, {
      params: { time_step: timeStep }
    })
    return response.data
  },

  async getFrames(batchId, startFrame = 0, endFrame = null) {
    const params = { start_frame: startFrame }
    if (endFrame !== null) params.end_frame = endFrame
    const response = await apiClient.get(`/scheduling/batches/${batchId}/frames`, { params })
    return response.data
  },

  async compareBatches(batchId1, batchId2) {
    const response = await apiClient.post('/scheduling/compare', null, {
      params: { batch_id1: batchId1, batch_id2: batchId2 }
    })
    return response.data
  },

  async getBatchReport(batchId, format = 'markdown') {
    const response = await apiClient.get(`/reports/batch/${batchId}`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'text'
    })
    return response.data
  },

  async getComparisonReport(batchId1, batchId2, format = 'markdown') {
    const response = await apiClient.get(`/reports/comparison/${batchId1}/${batchId2}`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'text'
    })
    return response.data
  }
}
