import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const getPrescriptions = (params) => {
  return api.get('/prescriptions', { params })
}

export const getPrescriptionStats = () => {
  return api.get('/prescriptions/stats')
}

export const getPrescriptionById = (id) => {
  return api.get(`/prescriptions/${id}`)
}

export const createPrescription = (data) => {
  return api.post('/prescriptions', data)
}

export const updatePrescription = (id, data) => {
  return api.put(`/prescriptions/${id}`, data)
}

export const reviewPrescription = (id, data) => {
  return api.post(`/prescriptions/${id}/review`, data)
}

export const getSummary = (params) => {
  return api.get('/reports/summary', { params })
}

export const exportReport = (params) => {
  return api.get('/reports/export', {
    params,
    responseType: 'blob'
  })
}

export default api
