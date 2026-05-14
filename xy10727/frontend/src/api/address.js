import request from '@/utils/request'

export function getAddressList(params) {
  return request({
    url: '/addresses',
    method: 'get',
    params
  })
}

export function getAddressDetail(id) {
  return request({
    url: `/addresses/${id}`,
    method: 'get'
  })
}

export function createAddress(data) {
  return request({
    url: '/addresses',
    method: 'post',
    data
  })
}

export function updateAddress(id, data) {
  return request({
    url: `/addresses/${id}`,
    method: 'put',
    data
  })
}

export function deleteAddress(id) {
  return request({
    url: `/addresses/${id}`,
    method: 'delete'
  })
}

export function manualCorrection(id, data) {
  return request({
    url: `/addresses/${id}/correction`,
    method: 'post',
    data
  })
}

export function reviewAddress(id, data) {
  return request({
    url: `/addresses/${id}/review`,
    method: 'post',
    data
  })
}

export function batchCompare(data) {
  return request({
    url: '/addresses/compare',
    method: 'post',
    data
  })
}

export function exportAddresses(data) {
  return request({
    url: '/addresses/export',
    method: 'post',
    data,
    responseType: 'blob'
  })
}

export function recalculateByVersion(data) {
  return request({
    url: '/addresses/recalculate',
    method: 'post',
    data
  })
}
