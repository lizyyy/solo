import request from './request'

export function getBorrowRecords(params) {
  return request.get('/borrows', { params })
}

export function getBorrowRecord(id) {
  return request.get(`/borrows/${id}`)
}

export function borrowDevice(data) {
  return request.post('/borrows', data)
}

export function returnDevice(id, data) {
  return request.post(`/borrows/${id}/return`, data)
}

export function getUserBorrowHistory(userId, params) {
  return request.get(`/borrows/user/${userId}`, { params })
}

export function exportReport(params) {
  return request.get('/export/report', {
    params,
    responseType: 'blob'
  })
}
