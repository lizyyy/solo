import axios from 'axios'
import dayjs from 'dayjs'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const greenhouseApi = {
  getAll: () => api.get('/greenhouses'),
  create: (data) => api.post('/greenhouses', data)
}

export const seedbedApi = {
  getAll: (greenhouseId) => api.get('/seedbeds', { params: { greenhouse_id: greenhouseId } }),
  create: (data) => api.post('/seedbeds', data)
}

export const plantBatchApi = {
  getAll: (params) => api.get('/plant-batches', { params }),
  create: (data) => api.post('/plant-batches', data)
}

export const importApi = {
  sensor: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/sensor', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  pollinationPlans: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/pollination-plans', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  isolation: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/isolation', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  plantBatches: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/plant-batches', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  employeeShifts: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/employee-shifts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  greenhouses: (data) => api.post('/import/greenhouses', data),
  seedbeds: (data) => api.post('/import/seedbeds', data)
}

export const assessmentApi = {
  run: (date) => api.post('/assessment/run', { date }),
  get: (params) => api.get('/assessment', { params }),
  update: (plantBatchId, data) => api.put(`/assessment/${plantBatchId}`, data)
}

export const exportApi = {
  markdown: (date) => {
    const url = `/api/export/markdown?date=${date || dayjs().format('YYYY-MM-DD')}`
    window.open(url, '_blank')
  },
  json: (date) => {
    const url = `/api/export/json?date=${date || dayjs().format('YYYY-MM-DD')}`
    window.open(url, '_blank')
  },
  fullReport: (date) => {
    const url = `/api/export/full-report?date=${date || dayjs().format('YYYY-MM-DD')}`
    window.open(url, '_blank')
  }
}

export const employeeShiftApi = {
  get: (date) => api.get('/employee-shifts', { params: { date } })
}

export const pollinationPlanApi = {
  get: (date) => api.get('/pollination-plans', { params: { date } })
}

export const isolationApi = {
  get: (params) => api.get('/isolation-schedules', { params })
}

export const sensorApi = {
  get: (params) => api.get('/sensor-readings', { params })
}

export default api
