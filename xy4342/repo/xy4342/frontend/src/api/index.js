import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export default {
  async getHealth() {
    return api.get('/health')
  },

  async getStats() {
    return api.get('/stats')
  },

  async getDataOverview() {
    return api.get('/data/overview')
  },

  async importStoryboard(formData) {
    return api.post('/import/storyboard/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  async importCharacters(formData) {
    return api.post('/import/characters/json', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  async importDialogues(formData) {
    return api.post('/import/dialogues/text', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  async uploadSketch(formData) {
    return api.post('/import/sketch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  async importBatch(formData) {
    return api.post('/import/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  async runValidation() {
    return api.post('/validate/run')
  },

  async getIssues(params = {}) {
    return api.get('/validate/issues', { params })
  },

  async getIssue(issueId) {
    return api.get(`/validate/issues/${issueId}`)
  },

  async getValidationStats() {
    return api.get('/validate/stats')
  },

  async updateIssue(issueId, data) {
    return api.patch(`/review/issues/${issueId}`, data)
  },

  async addReview(issueId, data) {
    return api.post(`/review/issues/${issueId}/reviews`, data)
  },

  async getIssueReviews(issueId) {
    return api.get(`/review/issues/${issueId}/reviews`)
  },

  async batchUpdateIssues(data) {
    return api.post('/review/issues/batch-update', data)
  },

  async deleteReview(reviewId) {
    return api.delete(`/review/reviews/${reviewId}`)
  },

  async exportMarkdown(params = {}) {
    return api.get('/export/markdown', { 
      params,
      responseType: 'blob'
    })
  },

  async exportCsv(params = {}) {
    return api.get('/export/csv', { 
      params,
      responseType: 'blob'
    })
  },

  async exportJson(params = {}) {
    return api.get('/export/json', { 
      params,
      responseType: 'blob'
    })
  },

  async getChapters() {
    return api.get('/data/chapters')
  },

  async getChapter(chapterId) {
    return api.get(`/data/chapters/${chapterId}`)
  },

  async getPanels(params = {}) {
    return api.get('/data/panels', { params })
  },

  async getPanel(panelId) {
    return api.get(`/data/panels/${panelId}`)
  },

  async getCharacters() {
    return api.get('/data/characters')
  },

  async getCharacter(charId) {
    return api.get(`/data/characters/${charId}`)
  },

  async getDialogues(params = {}) {
    return api.get('/data/dialogues', { params })
  },

  async clearAllData() {
    return api.delete('/data/clear-all')
  },

  async clearIssues() {
    return api.delete('/data/clear-issues')
  }
}
