import request from '@/utils/request'

export function getPaymentTriggerTypes() {
  return request({
    url: '/payments/trigger-types',
    method: 'get'
  })
}

export function getPaymentStatus(milestoneId) {
  return request({
    url: `/payments/milestone/${milestoneId}/status`,
    method: 'get'
  })
}

export function getPaymentHistory(milestoneId) {
  return request({
    url: `/payments/milestone/${milestoneId}/history`,
    method: 'get'
  })
}

export function getPaymentLogs(milestoneId) {
  return request({
    url: `/payments/milestone/${milestoneId}/logs`,
    method: 'get'
  })
}

export function approvePayment(milestoneId, data) {
  return request({
    url: `/payments/milestone/${milestoneId}/approve`,
    method: 'post',
    data
  })
}

export function confirmPayment(milestoneId, data) {
  return request({
    url: `/payments/milestone/${milestoneId}/confirm`,
    method: 'post',
    data
  })
}
