import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

request.interceptors.response.use(
  response => {
    const res = response.data
    if (res.success) {
      return res
    } else {
      ElMessage.error(res.error || '请求失败')
      return Promise.reject(new Error(res.error || '请求失败'))
    }
  },
  error => {
    ElMessage.error(error.message || '网络错误')
    return Promise.reject(error)
  }
)

export const getStatistics = (params) => request.get('/statistics', { params })
export const getRooms = () => request.get('/rooms')
export const updateRoom = (id, data) => request.put(`/rooms/${id}`, data)

export const getDevices = () => request.get('/devices')
export const updateDevice = (id, data) => request.put(`/devices/${id}`, data)

export const getBookings = (params) => request.get('/bookings', { params })
export const createBooking = (data) => request.post('/bookings', data)
export const updateBooking = (id, data) => request.put(`/bookings/${id}`, data)
export const cancelBooking = (id, data) => request.post(`/bookings/${id}/cancel`, data)

export const getTeaServices = (params) => request.get('/tea-services', { params })
export const updateTeaService = (id, data) => request.put(`/tea-services/${id}`, data)

export const getFaultTickets = (params) => request.get('/fault-tickets', { params })
export const updateFaultTicket = (id, data) => request.put(`/fault-tickets/${id}`, data)

export const getAnomalies = (params) => request.get('/anomalies', { params })
export const resolveAnomaly = (id, data) => request.put(`/anomalies/${id}/resolve`, data)

export const getModificationHistory = (params) => request.get('/modification-history', { params })

export const exportReport = (params) => {
  return axios.get('/api/report/export', {
    params,
    responseType: 'blob'
  })
}
