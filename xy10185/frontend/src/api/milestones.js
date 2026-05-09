import request from '@/utils/request'

export function getMilestones(projectId) {
  return request({
    url: `/milestones/project/${projectId}`,
    method: 'get'
  })
}

export function createMilestone(data) {
  return request({
    url: '/milestones',
    method: 'post',
    data
  })
}

export function updateMilestone(id, data) {
  return request({
    url: `/milestones/${id}`,
    method: 'put',
    data
  })
}

export function deleteMilestone(id) {
  return request({
    url: `/milestones/${id}`,
    method: 'delete'
  })
}

export function completeMilestone(id) {
  return request({
    url: `/milestones/${id}/complete`,
    method: 'post'
  })
}