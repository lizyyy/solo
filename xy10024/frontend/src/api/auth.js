import request from './request'

export function login(data) {
  return request.post('/auth/login', data)
}

export function register(data) {
  return request.post('/auth/register', data)
}

export function getCurrentUser() {
  return request.get('/users/me')
}

export function getUsers(params) {
  return request.get('/users', { params })
}

export function getUser(id) {
  return request.get(`/users/${id}`)
}

export function updateUser(id, data, version) {
  const config = {}
  if (version) {
    config.headers = { 'If-Match': version }
  }
  return request.put(`/users/${id}`, data, config)
}
