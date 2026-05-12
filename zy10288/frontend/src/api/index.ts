import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const getStatistics = () => api.get('/statistics')
export const getCards = (params?: any) => api.get('/cards', { params })
export const getCardById = (id: string) => api.get(`/cards/${id}`)
export const createCard = (data: any) => api.post('/cards', data)
export const updateCard = (id: string, data: any) => api.put(`/cards/${id}`, data)
export const deleteCard = (id: string) => api.delete(`/cards/${id}`)
export const syncCard = (id: string, simulateSuccess = true) => 
  api.post(`/cards/${id}/sync`, { simulateSuccess })
export const getCardSyncLogs = (id: string) => api.get(`/cards/${id}/sync-logs`)
export const importCards = (data: any) => api.post('/cards/import', data)

export const getAnomalies = (params?: any) => api.get('/anomalies', { params })
export const getAnomalyById = (id: string) => api.get(`/anomalies/${id}`)
export const processAnomaly = (id: string, data: any) => 
  api.post(`/anomalies/${id}/process`, data)
export const getAnomalyHistory = (id: string) => api.get(`/anomalies/${id}/history`)

export const getBlacklist = () => api.get('/blacklist')
export const createBlacklist = (data: any) => api.post('/blacklist', data)
export const updateBlacklist = (id: string, data: any) => api.put(`/blacklist/${id}`, data)
export const deleteBlacklist = (id: string) => api.delete(`/blacklist/${id}`)

export const getRefunds = () => api.get('/refunds')
export const createRefund = (data: any) => api.post('/refunds', data)
export const updateRefund = (id: string, data: any) => api.put(`/refunds/${id}`, data)

export default api
