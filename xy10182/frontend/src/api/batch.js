import request from '../utils/request'

export function getBatchList(params) {
  return request({
    url: '/batches',
    method: 'get',
    params
  })
}

export function getBatchDetail(id) {
  return request({
    url: `/batches/${id}`,
    method: 'get'
  })
}

export function getBatchByQR(qrCode) {
  return request({
    url: `/batches/qr/${qrCode}`,
    method: 'get'
  })
}

export function createBatch(data) {
  return request({
    url: '/batches',
    method: 'post',
    data
  })
}

export function updateBatch(id, data) {
  return request({
    url: `/batches/${id}`,
    method: 'put',
    data
  })
}

export function deleteBatch(id) {
  return request({
    url: `/batches/${id}`,
    method: 'delete'
  })
}
