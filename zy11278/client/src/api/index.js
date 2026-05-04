import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.success === false) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络错误'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

export const tradingDayApi = {
  getCurrent: () => api.get('/trading-day/current'),
  getActive: () => api.get('/trading-day/active'),
  getById: (id) => api.get(`/trading-day/${id}`),
  list: (params) => api.get('/trading-day', { params }),
  create: (data) => api.post('/trading-day', data),
  open: (id) => api.post(`/trading-day/${id}/open`),
  close: (id) => api.post(`/trading-day/${id}/close`),
  review: (id) => api.post(`/trading-day/${id}/review`),
  getPortfolioSummary: (id) => api.get(`/trading-day/${id}/portfolio-summary`)
}

export const tradingApi = {
  executeBuy: (data) => api.post('/trading/buy', data),
  executeSell: (data) => api.post('/trading/sell', data),
  cancelOrder: (id) => api.post(`/trading/order/${id}/cancel`),
  executePartialFill: (id, data) => api.post(`/trading/order/${id}/partial-fill`, data),
  getOrders: (params) => api.get('/trading/orders', { params }),
  getOrderById: (id) => api.get(`/trading/orders/${id}`),
  getTradeHistory: (params) => api.get('/trading/history', { params }),
  getTradeStatistics: (params) => api.get('/trading/statistics', { params })
}

export const importApi = {
  importQuotes: (formData, config) => api.post('/import/quotes', formData, config),
  importTradePlan: (data) => api.post('/import/trade-plan', data),
  importTradePlanFile: (formData, config) => api.post('/import/trade-plan/file', formData, config),
  getQuotes: (params) => api.get('/import/quotes', { params }),
  getQuoteBySymbol: (tradingDayId, symbol) => api.get(`/import/quotes/${tradingDayId}/${symbol}`),
  getTradePlans: (params) => api.get('/import/trade-plans', { params }),
  createTradePlan: (data) => api.post('/import/trade-plan', data),
  updateTradePlan: (id, data) => api.put(`/import/trade-plan/${id}`, data)
}

export const exportApi = {
  getReportPreview: (tradingDayId, params) => api.get(`/export/report/${tradingDayId}/preview`, { params }),
  getMarkdownUrl: (tradingDayId) => `/api/export/report/${tradingDayId}/markdown`,
  getHtmlUrl: (tradingDayId) => `/api/export/report/${tradingDayId}/html`,
  getCsvUrl: (tradingDayId) => `/api/export/report/${tradingDayId}/csv`
}

export const positionApi = {
  getPositions: (params) => api.get('/position', { params }),
  getAllPositions: (params) => api.get('/position/all', { params }),
  getPortfolioMetrics: (params) => api.get('/position/metrics', { params }),
  updateTradingDayMetrics: (tradingDayId) => api.post(`/position/metrics/${tradingDayId}/update`),
  getCashAccount: (params) => api.get('/position/cash', { params })
}

export const riskApi = {
  getAlerts: (params) => api.get('/risk/alerts', { params }),
  getAlertById: (id) => api.get(`/risk/alerts/${id}`),
  acknowledgeAlert: (id, data) => api.post(`/risk/alerts/${id}/acknowledge`, data),
  resolveAlert: (id, data) => api.post(`/risk/alerts/${id}/resolve`, data),
  runChecks: (tradingDayId) => api.post(`/risk/check/${tradingDayId}`)
}

export const reviewNoteApi = {
  getNotes: (params) => api.get('/review-note', { params }),
  getNoteById: (id) => api.get(`/review-note/${id}`),
  createNote: (data) => api.post('/review-note', data),
  updateNote: (id, data) => api.put(`/review-note/${id}`, data),
  deleteNote: (id) => api.delete(`/review-note/${id}`)
}

export const watchlistApi = {
  getWatchlist: (params) => api.get('/watchlist', { params }),
  addToWatchlist: (data) => api.post('/watchlist', data),
  updateWatchlistItem: (id, data) => api.put(`/watchlist/${id}`, data),
  removeFromWatchlist: (id) => api.delete(`/watchlist/${id}`),
  bulkImport: (data) => api.post('/watchlist/bulk-import', data)
}

export const healthApi = {
  check: () => api.get('/health')
}

export default api
