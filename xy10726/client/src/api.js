import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export const uploadInvoice = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/invoices/upload', formData, {
    onUploadProgress: onProgress,
    headers: { 'x-idempotency-key': `upload_${Date.now()}_${Math.random()}` }
  })
}

export const getInvoices = (params) => api.get('/invoices', { params })

export const getInvoice = (id) => api.get(`/invoices/${id}`)

export const retryInvoice = (id) => api.post(`/invoices/${id}/retry`)

export const reviewInvoice = (id, data) => api.post(`/invoices/${id}/review`, data)

export const resolveDuplicate = (id, data) => api.post(`/invoices/${id}/resolve-duplicate`, data)

export const getStatistics = () => api.get('/statistics')

export const exportInvoices = (data) => api.post('/export', data)

export const getExports = () => api.get('/exports')

export const getAuditLogs = () => api.get('/audit-logs')

export const recalculateInvoice = (id) => api.post(`/invoices/${id}/recalculate`)

export default api
