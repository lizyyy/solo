import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success) {
      return response.data
    }
    return Promise.reject(response.data?.error || { message: '请求失败' })
  },
  (error) => {
    const err = error.response?.data?.error || {
      message: error.message || '网络错误',
      code: 'NETWORK_ERROR'
    }
    return Promise.reject(err)
  }
)

export const leadApi = {
  async getMetadata() {
    return api.get('/leads/metadata')
  },

  async getLeads(params = {}) {
    return api.get('/leads', { params })
  },

  async getLeadById(id) {
    return api.get(`/leads/${id}`)
  },

  async createLead(data) {
    return api.post('/leads', data)
  },

  async updateLead(id, data) {
    return api.put(`/leads/${id}`, data)
  },

  async deleteLead(id) {
    return api.delete(`/leads/${id}`)
  },

  async exportMarkdown(id) {
    return api.get(`/leads/${id}/export`, { responseType: 'blob' })
  }
}

export default leadApi
