import request from '../utils/request'

export function getReagentList(params) {
  return request({
    url: '/reagents',
    method: 'get',
    params
  })
}

export function getReagentDetail(id) {
  return request({
    url: `/reagents/${id}`,
    method: 'get'
  })
}

export function createReagent(data) {
  return request({
    url: '/reagents',
    method: 'post',
    data
  })
}

export function updateReagent(id, data) {
  return request({
    url: `/reagents/${id}`,
    method: 'put',
    data
  })
}

export function deleteReagent(id) {
  return request({
    url: `/reagents/${id}`,
    method: 'delete'
  })
}

export function getCategories() {
  return request({
    url: '/reagents/categories/list',
    method: 'get'
  })
}
