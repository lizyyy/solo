import { defineStore } from 'pinia'
import axios from 'axios'

export const useQuotaStore = defineStore('quota', {
  state: () => ({
    stats: {},
    members: [],
    projects: [],
    quotaPackages: [],
    requests: [],
    credits: [],
    summaries: []
  }),
  
  actions: {
    async fetchStats() {
      const res = await axios.get('/api/dashboard/stats')
      this.stats = res.data
    },
    
    async fetchMembers() {
      const res = await axios.get('/api/members')
      this.members = res.data
    },
    
    async fetchProjects(memberId) {
      const params = memberId ? { member_id: memberId } : {}
      const res = await axios.get('/api/projects', { params })
      this.projects = res.data
    },
    
    async fetchQuotaPackages(filters) {
      const res = await axios.get('/api/quota-packages', { params: filters })
      this.quotaPackages = res.data
    },
    
    async fetchRequests(filters) {
      const res = await axios.get('/api/generation-requests', { params: filters })
      this.requests = res.data
    },
    
    async fetchCredits(filters) {
      const res = await axios.get('/api/failure-credits', { params: filters })
      this.credits = res.data
    },
    
    async fetchSummaries(filters) {
      const res = await axios.get('/api/monthly-summaries', { params: filters })
      this.summaries = res.data
    },
    
    async createRequest(data) {
      return await axios.post('/api/generation-requests', data)
    },
    
    async completeRequest(id) {
      return await axios.post(`/api/generation-requests/${id}/complete`)
    },
    
    async failRequest(id, errorMessage) {
      return await axios.post(`/api/generation-requests/${id}/fail`, { error_message: errorMessage })
    },
    
    async reviewCredit(id, status, reviewedBy, note) {
      return await axios.post(`/api/failure-credits/${id}/review`, {
        status,
        reviewed_by: reviewedBy,
        review_note: note
      })
    }
  }
})
