import request from '@/utils/request'

export function getProjectReport(projectId) {
  return request({
    url: `/reports/project/${projectId}`,
    method: 'get'
  })
}

export function exportProjectReport(projectId) {
  return request({
    url: `/reports/project/${projectId}/export`,
    method: 'get',
    responseType: 'blob'
  })
}

export function exportOverviewReport() {
  return request({
    url: '/reports/overview/export',
    method: 'get',
    responseType: 'blob'
  })
}