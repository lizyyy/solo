export const createAuditLog = (auditLogs, action, entityType, entityId, description, operator = 'system') => {
  const log = {
    id: Date.now() + Math.random(),
    action,
    entityType,
    entityId,
    description,
    operator,
    timestamp: new Date().toISOString(),
    ip: 'localhost',
    userAgent: navigator?.userAgent || 'unknown'
  }
  auditLogs.push(log)
  return log
}

export const trackModification = (record, field, oldValue, newValue, operator) => {
  if (!record.manualChanges) {
    record.manualChanges = []
  }
  
  const change = {
    field,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
    operator,
    changeId: Date.now() + Math.random()
  }
  
  record.manualChanges.push(change)
  
  if (!record.statusHistory) {
    record.statusHistory = []
  }
  
  record.statusHistory.push({
    status: 'modified',
    timestamp: change.timestamp,
    operator,
    changeId: change.changeId
  })
  
  return change
}

export const getRecordAuditTrail = (record) => {
  return {
    originalLineNumber: record.originalLineNumber,
    originalObstacleNote: record.originalObstacleNote,
    manualChanges: record.manualChanges || [],
    statusHistory: record.statusHistory || [],
    processingStatus: record.processingStatus,
    coordinateType: record.coordinateType,
    isMixedCoordinate: record.isMixedCoordinate,
    importTimestamp: record.importTimestamp
  }
}

export const formatAuditTrailForDisplay = (auditTrail) => {
  const lines = []
  
  lines.push(`原始行号: ${auditTrail.originalLineNumber}`)
  lines.push(`导入时间: ${formatDateTime(auditTrail.importTimestamp)}`)
  lines.push(`原始备注: ${auditTrail.originalObstacleNote || '(空)'}`)
  lines.push(`当前状态: ${getStatusText(auditTrail.processingStatus)}`)
  lines.push(`坐标类型: ${getCoordinateTypeText(auditTrail.coordinateType)}`)
  
  if (auditTrail.isMixedCoordinate) {
    lines.push('⚠️ 坐标混合，待巡检组复核')
  }
  
  if (auditTrail.manualChanges.length > 0) {
    lines.push('')
    lines.push('人工修改记录:')
    auditTrail.manualChanges.forEach((change, index) => {
      lines.push(`  ${index + 1}. [${formatDateTime(change.timestamp)}] ${change.operator}`)
      lines.push(`     字段: ${getFieldText(change.field)}`)
      lines.push(`     原值: ${change.oldValue || '(空)'}`)
      lines.push(`     新值: ${change.newValue || '(空)'}`)
    })
  }
  
  if (auditTrail.statusHistory.length > 0) {
    lines.push('')
    lines.push('状态变更历史:')
    auditTrail.statusHistory.forEach((status, index) => {
      lines.push(`  ${index + 1}. [${formatDateTime(status.timestamp)}] ${status.operator} -> ${getStatusText(status.status)}`)
    })
  }
  
  return lines.join('\n')
}

export const exportAuditTrailAsCSV = (records) => {
  const headers = [
    '原始行号',
    '墙板编号',
    '原始备注',
    '当前备注',
    '修改次数',
    '当前状态',
    '坐标类型',
    '是否坐标混合',
    '导入时间',
    '最后修改时间',
    '最后修改人'
  ]
  
  const rows = records.map(record => {
    const lastChange = record.manualChanges?.[record.manualChanges.length - 1]
    return [
      record.originalLineNumber,
      record.wallPanelCode,
      record.originalObstacleNote || '',
      record.obstacleNote || '',
      record.manualChanges?.length || 0,
      getStatusText(record.processingStatus),
      getCoordinateTypeText(record.coordinateType),
      record.isMixedCoordinate ? '是' : '否',
      record.importTimestamp,
      lastChange?.timestamp || '',
      lastChange?.operator || ''
    ]
  })
  
  return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function formatDateTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待处理',
    'pending_review': '待复核',
    'manual_updated': '已人工更新',
    'modified': '已修改',
    'reviewed': '已复核',
    'approved': '已批准',
    'exported': '已导出'
  }
  return statusMap[status] || status
}

function getCoordinateTypeText(type) {
  const typeMap = {
    'latlng': '经纬度',
    'metric': '米制',
    'unknown': '未知'
  }
  return typeMap[type] || type
}

function getFieldText(field) {
  const fieldMap = {
    'obstacleNote': '障碍物备注',
    'sectionNote': '剖面备注',
    'coordinate': '坐标',
    'wallPanelCode': '墙板编号'
  }
  return fieldMap[field] || field
}

export const getAuditStatistics = (auditLogs) => {
  const stats = {
    totalActions: auditLogs.length,
    actionsByType: {},
    actionsByOperator: {},
    actionsByEntity: {},
    todayActions: 0
  }
  
  const today = new Date().toDateString()
  
  auditLogs.forEach(log => {
    stats.actionsByType[log.action] = (stats.actionsByType[log.action] || 0) + 1
    stats.actionsByOperator[log.operator] = (stats.actionsByOperator[log.operator] || 0) + 1
    stats.actionsByEntity[log.entityType] = (stats.actionsByEntity[log.entityType] || 0) + 1
    
    if (new Date(log.timestamp).toDateString() === today) {
      stats.todayActions++
    }
  })
  
  return stats
}
