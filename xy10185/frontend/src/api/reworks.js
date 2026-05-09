import request from '@/utils/request'

export function getReworks(deliverableId) {
  return request({
    url: `/reworks/deliverable/${deliverableId}`,
    method: 'get'
  })
}

export function createRework(data) {
  return request({
    url: '/reworks',
    method: 'post',
    data
  })
}

export function updateRework(id, data) {
  return request({
    url: `/reworks/${id}`,
    method: 'put',
    data
  })
}

export function completeRework(id) {
  return request({
    url: `/reworks/${id}/complete`,
    method: 'post'
  })
}

export function deleteRework(id) {
  return request({
    url: `/reworks/${id}`,
    method: 'delete'
  })
}