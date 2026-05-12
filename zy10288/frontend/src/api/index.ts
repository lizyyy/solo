import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const getStatistics = () => api.get('/statistics')
export const getCards = (params?: any) => api.get('/cards', { params })
export const getCardById = (id: string) => api.get(`/cards/${id}`)
export const syncCard = (id: string, simulateSuccess = true) => 
  api.post(`/cards/${id}/sync`, { simulateSuccess })
export const getCardSyncLogs = (id: string) => api.get(`/cards/${id}/sync-logs`)
export const getAnomalies = (params?: any) => api.get('/anomalies', { params })
export const getAnomalyById = (id: string) => api.get(`/anomalies/${id}`)
export const processAnomaly = (id: string, data: any) => 
  api.post(`/anomalies/${id}/process`, data)
export const getAnomalyHistory = (id: string) => api.get(`/anomalies/${id}/history`)
export const getBlacklist = () => api.get('/blacklist')
export const getRefunds = () => api.get('/refunds')

export default api
