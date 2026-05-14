import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const ticketApi = {
  getList: (params) => api.get('/tickets', { params }),
  getDetail: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  pause: (data) => api.post(`/tickets/${data.ticket_id}/pause`, data),
  resume: (data) => api.post(`/tickets/${data.ticket_id}/resume`, data),
  compensation: (data) => api.post(`/tickets/${data.ticket_id}/compensation`, data),
  calculateSLA: (data) => api.post('/tickets/calculate-sla', data),
  getSlaPaths: (id) => api.get(`/tickets/${id}/sla-paths`),
  createEscalation: (data) => api.post('/tickets/escalation', data),
  createApproval: (data) => api.post('/tickets/approval', data),
  approvalAction: (id, data) => api.post(`/tickets/approval/${id}/action`, data)
}

export const configApi = {
  getSlaRules: () => api.get('/config/sla-rules'),
  createSlaRule: (data) => api.post('/config/sla-rules', data),
  updateSlaRule: (id, data) => api.put(`/config/sla-rules/${id}`, data),
  getPauseReasons: () => api.get('/config/pause-reasons'),
  createPauseReason: (data) => api.post('/config/pause-reasons', data),
  deletePauseReason: (id) => api.delete(`/config/pause-reasons/${id}`),
  getHolidays: () => api.get('/config/holidays'),
  createHoliday: (data) => api.post('/config/holidays', data),
  deleteHoliday: (id) => api.delete(`/config/holidays/${id}`)
}

export const exportApi = {
  getColumns: () => api.get('/export/columns'),
  exportTicket: (id) => {
    window.open(`/api/export/ticket/${id}`, '_blank')
  },
  exportTickets: (params) => {
    const query = new URLSearchParams(params).toString()
    window.open(`/api/export/tickets?${query}`, '_blank')
  },
  exportSelected: (ticketIds) => {
    api.post('/export/selected', ticketIds, {
      responseType: 'blob'
    }).then(blob => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SLA选中工单报表_${new Date().getTime()}.xlsx`
      a.click()
    })
  }
}

export default api
