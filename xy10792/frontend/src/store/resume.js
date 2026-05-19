import { defineStore } from 'pinia'
import api from '@/utils/api'

export const useResumeStore = defineStore('resume', {
  state: () => ({
    resumes: [],
    currentResume: null,
    statistics: null,
    loading: false
  }),

  actions: {
    async fetchResumes(params = {}) {
      this.loading = true
      try {
        const response = await api.getResumes(params)
        this.resumes = response.data
        return response.data
      } finally {
        this.loading = false
      }
    },

    async fetchResumeDetail(id) {
      this.loading = true
      try {
        const response = await api.getResumeDetail(id)
        this.currentResume = response.data
        return response.data
      } finally {
        this.loading = false
      }
    },

    async uploadResume(file) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.uploadResume(formData)
      await this.fetchResumes()
      return response.data
    },

    async parseResume(id) {
      const response = await api.parseResume(id)
      await this.fetchResumeDetail(id)
      return response.data
    },

    async matchResume(id, jobId = null) {
      const response = await api.matchResume(id, jobId)
      await this.fetchResumeDetail(id)
      return response.data
    },

    async recalculateMatch(id) {
      const response = await api.recalculateMatch(id)
      await this.fetchResumeDetail(id)
      return response.data
    },

    async reviewResume(id, data) {
      const response = await api.reviewResume(id, data)
      await this.fetchResumeDetail(id)
      return response.data
    },

    async fetchStatistics() {
      const response = await api.getStatistics()
      this.statistics = response.data
      return response.data
    },

    async getParseDiff(id, version1, version2) {
      const response = await api.getParseDiff(id, version1, version2)
      return response.data
    }
  }
})
