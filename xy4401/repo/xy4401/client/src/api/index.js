import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const uploadApi = {
  uploadTideCsv(file) {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/uploads/tide', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  uploadBerthJson(data) {
    return api.post('/uploads/berth', data)
  },
  uploadBargeJson(data) {
    return api.post('/uploads/barge', data)
  },
  getStatus() {
    return api.get('/uploads/status')
  }
}

export const schedulingApi = {
  calculate() {
    return api.post('/scheduling/calculate')
  },
  validate(schedule) {
    return api.post('/scheduling/validate', schedule)
  },
  save(schedule) {
    return api.post('/scheduling/save', schedule)
  },
  list() {
    return api.get('/scheduling/list')
  },
  get(id) {
    return api.get(`/scheduling/${id}`)
  },
  delete(id) {
    return api.delete(`/scheduling/${id}`)
  },
  saveNotes(id, bargeId, notes) {
    return api.post('/scheduling/save-notes', { id, bargeId, notes })
  }
}

export const exportApi = {
  getMarkdown(id) {
    return api.get(`/export/markdown/${id}`, {
      responseType: 'blob'
    })
  },
  getJson(id) {
    return api.get(`/export/json/${id}`, {
      responseType: 'blob'
    })
  },
  generateMarkdown(schedule) {
    return api.post('/export/markdown', schedule)
  },
  generateJson(schedule) {
    return api.post('/export/json', schedule)
  }
}

export default api
