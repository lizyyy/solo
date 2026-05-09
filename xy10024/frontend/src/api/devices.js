import request from './request'

export function getDevices(params) {
  return request.get('/devices', { params })
}

export function getDevice(id) {
  return request.get(`/devices/${id}`)
}

export function createDevice(data) {
  return request.post('/devices', data)
}

export function updateDevice(id, data, version) {
  const config = {}
  if (version) {
    config.headers = { 'If-Match': version }
  }
  return request.put(`/devices/${id}`, data, config)
}

export function deleteDevice(id) {
  return request.delete(`/devices/${id}`)
}
