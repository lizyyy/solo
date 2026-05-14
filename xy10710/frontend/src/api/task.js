import request from '@/utils/request'

export const getTasks = (params) => {
  return request({
    url: '/tasks',
    method: 'get',
    params
  })
}

export const getTaskById = (id) => {
  return request({
    url: `/tasks/${id}`,
    method: 'get'
  })
}

export const createTask = (data) => {
  return request({
    url: '/tasks',
    method: 'post',
    data
  })
}

export const confirmWatermark = (id) => {
  return request({
    url: `/tasks/${id}/confirm-watermark`,
    method: 'post'
  })
}

export const approveTask = (id, approvedBy) => {
  return request({
    url: `/tasks/${id}/approve`,
    method: 'post',
    params: { approved_by: approvedBy }
  })
}

export const retryTask = (id) => {
  return request({
    url: `/tasks/${id}/retry`,
    method: 'post'
  })
}

export const rollbackTask = (id, targetVersion) => {
  return request({
    url: `/tasks/${id}/rollback`,
    method: 'post',
    params: { target_version: targetVersion }
  })
}

export const getTaskVersions = (id) => {
  return request({
    url: `/tasks/${id}/versions`,
    method: 'get'
  })
}

export const getTaskErrors = (id) => {
  return request({
    url: `/tasks/${id}/errors`,
    method: 'get'
  })
}

export const exportTasks = (data) => {
  return request({
    url: '/tasks/export',
    method: 'post',
    data
  })
}

export const getExportRecords = () => {
  return request({
    url: '/tasks/export/records',
    method: 'get'
  })
}

export const downloadExport = (fileName) => {
  window.open(`/api/tasks/export/download/${fileName}`, '_blank')
}
