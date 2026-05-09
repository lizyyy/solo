import request from '../utils/request'

export function getAlerts() {
  return request({
    url: '/alerts',
    method: 'get'
  })
}

export function getOverview() {
  return request({
    url: '/alerts/overview',
    method: 'get'
  })
}
