import request from '../utils/request'

export function getRecordList(params) {
  return request({
    url: '/records',
    method: 'get',
    params
  })
}

export function getRecordDetail(id) {
  return request({
    url: `/records/${id}`,
    method: 'get'
  })
}

export function scanOperation(data) {
  return request({
    url: '/records/scan',
    method: 'post',
    data
  })
}

export function createRecord(data) {
  return request({
    url: '/records',
    method: 'post',
    data
  })
}

export function getBatchHistory(batchId) {
  return request({
    url: `/records/batch/${batchId}/history`,
    method: 'get'
  })
}
