import request from './request'

export function getAuditLogs(params) {
  return request.get('/audit', { params })
}

export function getResourceHistory(resourceType, resourceId) {
  return request.get(`/audit/${resourceType}/${resourceId}`)
}

export function getEventHistory(aggregateType, aggregateId, limit) {
  return request.get(`/events/${aggregateType}/${aggregateId}`, {
    params: { limit }
  })
}

export function replayAggregate(aggregateType, aggregateId) {
  return request.post(`/events/replay/${aggregateType}/${aggregateId}`)
}

export function getEventsByRequestId(requestId) {
  return request.get(`/events/request/${requestId}`)
}
