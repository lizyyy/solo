import * as XLSX from 'xlsx'

export const exportUnifiedData = (unifiedResult, format = 'json') => {
  if (!unifiedResult) {
    throw new Error('统一数据源为空，请先导入数据')
  }

  switch (format) {
    case 'json':
      return exportToJSON(unifiedResult)
    case 'excel':
      return exportToExcel(unifiedResult)
    case 'csv':
      return exportToCSV(unifiedResult)
    default:
      return exportToJSON(unifiedResult)
  }
}

export const exportToJSON = (unifiedResult) => {
  const exportData = {
    exportTime: new Date().toISOString(),
    exportedBy: '小魏',
    version: '1.0',
    obstacleRecords: unifiedResult.obstacleRecords.map(r => ({
      originalLineNumber: r.originalLineNumber,
      wallPanelCode: r.wallPanelCode,
      coordinate: r.coordinate,
      coordinateType: r.coordinateType,
      isMixedCoordinate: r.isMixedCoordinate,
      originalObstacleNote: r.originalObstacleNote,
      obstacleNote: r.obstacleNote,
      processingStatus: r.processingStatus,
      manualChanges: r.manualChanges,
      statusHistory: r.statusHistory,
      importTimestamp: r.importTimestamp
    })),
    floorSectionRecords: unifiedResult.floorSectionRecords,
    siteInstructions: unifiedResult.siteInstructions,
    affectedRecords: unifiedResult.affectedRecords,
    selfCheckResults: unifiedResult.selfCheckResults
  }

  return {
    data: JSON.stringify(exportData, null, 2),
    filename: `吊装预演_${formatDate(new Date())}.json`,
    mimeType: 'application/json'
  }
}

export const exportToExcel = (unifiedResult) => {
  const wb = XLSX.utils.book_new()

  const obstacleData = unifiedResult.obstacleRecords.map(r => ({
    '原始行号': r.originalLineNumber,
    '墙板编号': r.wallPanelCode,
    '坐标': r.coordinate,
    '坐标类型': getCoordinateTypeText(r.coordinateType),
    '坐标混合': r.isMixedCoordinate ? '是(待复核)' : '否',
    '原始备注': r.originalObstacleNote,
    '当前备注': r.obstacleNote,
    '处理状态': getStatusText(r.processingStatus),
    '修改次数': r.manualChanges?.length || 0,
    '导入时间': formatDateTime(r.importTimestamp)
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obstacleData), '障碍物明细')

  if (unifiedResult.affectedRecords && unifiedResult.affectedRecords.length > 0) {
    const affectedData = unifiedResult.affectedRecords.map(r => ({
      '墙板编号': r.wallPanelCode,
      '障碍物备注': r.obstacleNote,
      '受影响原因': r.affectedReason,
      '受影响时间': formatDateTime(r.affectedAt)
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(affectedData), '受影响记录')
  }

  const selfCheckData = []
  Object.entries(unifiedResult.selfCheckResults).forEach(([key, result]) => {
    selfCheckData.push({
      '检查项': getCheckItemText(key),
      '检查结果': result.passed ? '通过' : '不通过',
      '问题数量': result.count || 0,
      '说明': result.message || ''
    })
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(selfCheckData), '自检结果')

  const auditData = unifiedResult.obstacleRecords
    .filter(r => r.manualChanges && r.manualChanges.length > 0)
    .flatMap(r => r.manualChanges.map(c => ({
      '原始行号': r.originalLineNumber,
      '墙板编号': r.wallPanelCode,
      '修改字段': getFieldText(c.field),
      '原值': c.oldValue || '(空)',
      '新值': c.newValue || '(空)',
      '修改人': c.operator,
      '修改时间': formatDateTime(c.timestamp)
    })))
  if (auditData.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditData), '修改记录')
  }

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return {
    data: new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename: `吊装预演_${formatDate(new Date())}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}

export const exportToCSV = (unifiedResult) => {
  const headers = [
    '原始行号',
    '墙板编号',
    '坐标',
    '坐标类型',
    '坐标混合',
    '原始备注',
    '当前备注',
    '处理状态',
    '修改次数'
  ]

  const rows = unifiedResult.obstacleRecords.map(r => [
    r.originalLineNumber,
    r.wallPanelCode,
    r.coordinate,
    getCoordinateTypeText(r.coordinateType),
    r.isMixedCoordinate ? '是(待复核)' : '否',
    r.originalObstacleNote || '',
    r.obstacleNote || '',
    getStatusText(r.processingStatus),
    r.manualChanges?.length || 0
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return {
    data: csvContent,
    filename: `吊装预演_${formatDate(new Date())}.csv`,
    mimeType: 'text/csv;charset=utf-8;'
  }
}

export const downloadFile = (exportResult) => {
  const url = URL.createObjectURL(
    exportResult.data instanceof Blob 
      ? exportResult.data 
      : new Blob([exportResult.data], { type: exportResult.mimeType })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = exportResult.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const getUnifiedResultForDisplay = (unifiedResult) => {
  if (!unifiedResult) return null
  return {
    obstacleRecords: unifiedResult.obstacleRecords,
    floorSectionRecords: unifiedResult.floorSectionRecords,
    siteInstructions: unifiedResult.siteInstructions,
    affectedRecords: unifiedResult.affectedRecords,
    selfCheckResults: unifiedResult.selfCheckResults,
    generatedAt: unifiedResult.generatedAt
  }
}

export const getUnifiedResultForAPI = (unifiedResult) => {
  if (!unifiedResult) return null
  return {
    code: 200,
    message: 'success',
    data: {
      obstacleRecords: unifiedResult.obstacleRecords,
      floorSectionRecords: unifiedResult.floorSectionRecords,
      siteInstructions: unifiedResult.siteInstructions,
      affectedRecords: unifiedResult.affectedRecords,
      selfCheckResults: unifiedResult.selfCheckResults,
      generatedAt: unifiedResult.generatedAt
    },
    timestamp: new Date().toISOString()
  }
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatDateTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN')
}

function getCoordinateTypeText(type) {
  const typeMap = {
    'latlng': '经纬度',
    'metric': '米制',
    'unknown': '未知'
  }
  return typeMap[type] || type
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

function getCheckItemText(key) {
  const checkMap = {
    'duplicateCheck': '重复导入检查',
    'coordinateCheck': '坐标格式检查',
    'recalculateCheck': '补录重算检查',
    'exportConsistencyCheck': '导出一致性检查'
  }
  return checkMap[key] || key
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
