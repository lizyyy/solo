import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default {
  getStats() {
    return api.get('/stats')
  },
  
  getSessions(skip = 0, limit = 100) {
    return api.get('/sessions', { params: { skip, limit } })
  },
  
  getSession(id) {
    return api.get(`/sessions/${id}`)
  },
  
  getSessionByState(state) {
    return api.get(`/sessions/state/${state}`)
  },
  
  createSession(data) {
    return api.post('/sessions', data)
  },
  
  updateSession(id, data) {
    return api.patch(`/sessions/${id}`, data)
  },
  
  createTokenExchange(data) {
    return api.post('/token-exchange', data)
  },
  
  updateTokenExchange(id, data) {
    return api.patch(`/token-exchange/${id}`, data)
  },
  
  recalculateSession(sessionId) {
    return api.post('/recalculate', { session_id: sessionId })
  },
  
  compareSessions(sessionId1, sessionId2) {
    return api.post('/diff', { session_id_1: sessionId1, session_id_2: sessionId2 })
  },
  
  createExport(data) {
    return api.post('/export', data)
  },
  
  getExports(skip = 0, limit = 100) {
    return api.get('/exports', { params: { skip, limit } })
  },
  
  downloadExport(id) {
    window.open(`/api/v1/exports/${id}/download`, '_blank')
  }
}
