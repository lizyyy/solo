import request from '@/utils/request'

export function getDeliverables(milestoneId) {
  return request({
    url: `/deliverables/milestone/${milestoneId}`,
    method: 'get'
  })
}

export function getDeliverable(id) {
  return request({
    url: `/deliverables/${id}`,
    method: 'get'
  })
}

export function createDeliverable(formData) {
  return request({
    url: '/deliverables',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export function updateDeliverable(id, data) {
  return request({
    url: `/deliverables/${id}`,
    method: 'put',
    data
  })
}

export function deleteDeliverable(id) {
  return request({
    url: `/deliverables/${id}`,
    method: 'delete'
  })
}

export function downloadDeliverable(id) {
  return request({
    url: `/deliverables/${id}/download`,
    method: 'get',
    responseType: 'blob'
  })
}

export function acceptDeliverable(id, data) {
  return request({
    url: `/deliverables/${id}/accept`,
    method: 'post',
    data
  })
}

export function rejectDeliverable(id, data) {
  return request({
    url: `/deliverables/${id}/reject`,
    method: 'post',
    data
  })
}