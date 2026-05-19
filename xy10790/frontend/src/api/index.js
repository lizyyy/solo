import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const progressApi = {
  getList(params) {
    return api.get('/progress', { params })
  },
  getDetail(id) {
    return api.get(`/progress/${id}`)
  },
  create(data) {
    return api.post('/progress', data)
  },
  update(id, data) {
    return api.put(`/progress/${id}`, data)
  },
  publish(data) {
    return api.post('/progress/publish', data)
  }
}

export const remedialApi = {
  getAbnormal(params) {
    return api.get('/remedial-tasks/abnormal', { params })
  },
  review(data) {
    return api.post('/remedial-tasks/review', data)
  }
}

export const certificateApi = {
  getList(params) {
    return api.get('/certificates', { params })
  },
  confirm(data) {
    return api.post('/certificates/confirm', data)
  },
  create(data) {
    return api.post('/certificates', data)
  },
  createFromProgress(data) {
    return api.post('/certificates/create-from-progress', data)
  },
  issue(data) {
    return api.post('/certificates/issue', data)
  }
}

export const reportApi = {
  getList(params) {
    return api.get('/reports', { params })
  },
  export(data) {
    return api.post('/export', data)
  },
  download(reportId) {
    window.open(`/api/reports/${reportId}/download`, '_blank')
  }
}

export const logApi = {
  getList(params) {
    return api.get('/operation-logs', { params })
  }
}

export const statisticsApi = {
  get() {
    return api.get('/statistics')
  }
}

export default api
