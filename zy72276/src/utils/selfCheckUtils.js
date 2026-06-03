export const detectDuplicates = (records) => {
  const details = []
  const seen = new Map()
  const duplicates = []

  records.forEach((record, index) => {
    const key = generateDuplicateKey(record)
    if (seen.has(key)) {
      if (!duplicates.includes(seen.get(key))) {
        duplicates.push(seen.get(key))
        details.push({
          type: 'duplicate',
          severity: 'warning',
          recordId: seen.get(key).id,
          wallPanelCode: seen.get(key).wallPanelCode,
          originalLineNumber: seen.get(key).originalLineNumber,
          message: `墙板编号 ${seen.get(key).wallPanelCode} 存在重复导入`,
          duplicateWith: record.originalLineNumber
        })
      }
      details.push({
        type: 'duplicate',
        severity: 'warning',
        recordId: record.id,
        wallPanelCode: record.wallPanelCode,
        originalLineNumber: record.originalLineNumber,
        message: `与第 ${seen.get(key).originalLineNumber} 行记录重复`,
        duplicateWith: seen.get(key).originalLineNumber
      })
    } else {
      seen.set(key, record)
    }
  })

  return {
    passed: duplicates.length === 0,
    count: duplicates.length,
    details
  }
}

export const detectMixedCoordinates = (records) => {
  const details = []
  const mixedRecords = []

  records.forEach((record) => {
    const coordinateType = detectCoordinateType(record)
    const hasMixed = checkMixedCoordinate(record)
    
    if (hasMixed) {
      mixedRecords.push(record)
      details.push({
        type: 'mixed_coordinate',
        severity: 'error',
        recordId: record.id,
        wallPanelCode: record.wallPanelCode,
        originalLineNumber: record.originalLineNumber,
        message: `检测到经纬度和米制坐标混合，需巡检组复核`,
        coordinate: record.coordinate,
        detectedTypes: detectAllCoordinateTypes(record),
        reservedForReview: true
      })
      record.isMixedCoordinate = true
      record.processingStatus = 'pending_review'
    }
  })

  return {
    passed: mixedRecords.length === 0,
    count: mixedRecords.length,
    details,
    message: mixedRecords.length > 0 
      ? `发现 ${mixedRecords.length} 条坐标混合记录，已标记待复核` 
      : '坐标格式检查通过'
  }
}

export const recalculateAfterSupplement = (records) => {
  const details = []
  const recalculated = []

  records.forEach((record) => {
    if (record.manualChanges && record.manualChanges.length > 0) {
      const supplementChanges = record.manualChanges.filter(
        c => c.field === 'obstacleNote' && c.oldValue === ''
      )
      if (supplementChanges.length > 0) {
        recalculated.push(record)
        details.push({
          type: 'recalculate',
          severity: 'info',
          recordId: record.id,
          wallPanelCode: record.wallPanelCode,
          originalLineNumber: record.originalLineNumber,
          message: `补录障碍物备注后已重新计算`,
          recalculatedAt: supplementChanges[0].timestamp,
          operator: supplementChanges[0].operator
        })
      }
    }
  })

  return {
    passed: true,
    count: recalculated.length,
    details,
    message: recalculated.length > 0 
      ? `${recalculated.length} 条记录补录后已重算` 
      : '暂无补录重算记录'
  }
}

export const validateExportConsistency = (records, unifiedResult) => {
  const details = []
  let passed = true

  if (!unifiedResult) {
    return {
      passed: false,
      details: [{
        type: 'consistency',
        severity: 'error',
        message: '统一结果数据源为空'
      }]
    }
  }

  if (records.length !== unifiedResult.obstacleRecords.length) {
    passed = false
    details.push({
      type: 'consistency',
      severity: 'error',
      message: `记录数量不一致：源数据 ${records.length} 条，统一结果 ${unifiedResult.obstacleRecords.length} 条`
    })
  }

  records.forEach((record, index) => {
    const unifiedRecord = unifiedResult.obstacleRecords[index]
    if (!unifiedRecord) return

    const fieldsToCheck = [
      'wallPanelCode', 'coordinate', 'obstacleNote', 
      'processingStatus', 'isMixedCoordinate'
    ]

    fieldsToCheck.forEach(field => {
      if (record[field] !== unifiedRecord[field]) {
        passed = false
        details.push({
          type: 'consistency',
          severity: 'error',
          recordId: record.id,
          field,
          originalValue: record[field],
          unifiedValue: unifiedRecord[field],
          message: `${record.wallPanelCode} 的 ${field} 字段不一致`
        })
      }
    })
  })

  return {
    passed,
    count: details.length,
    details,
    message: passed ? '导出一致性检查通过' : `发现 ${details.length} 处不一致`
  }
}

function generateDuplicateKey(record) {
  return `${record.wallPanelCode || ''}_${record.coordinate || ''}_${record.obstacleNote || ''}`
}

function detectCoordinateType(record) {
  if (!record.coordinate) return 'unknown'
  const coordStr = String(record.coordinate)
  
  if (coordStr.includes(',') || coordStr.includes('°') || /^\d{1,3}\.\d+,\s*\d{1,3}\.\d+$/.test(coordStr)) {
    return 'latlng'
  }
  if (/^\d+(\.\d+)?$/.test(coordStr) || /^[XYZxyz]:/.test(coordStr)) {
    return 'metric'
  }
  return 'unknown'
}

function checkMixedCoordinate(record) {
  if (!record.coordinate) return false
  const coordStr = String(record.coordinate)
  
  const hasLatLng = coordStr.includes(',') || coordStr.includes('°') || /\d{1,3}\.\d+,\s*\d{1,3}\.\d+/.test(coordStr)
  const hasMetric = /[XYZxyz]:/.test(coordStr) || (coordStr.match(/\d+\.\d+/g)?.length === 1 && !coordStr.includes(','))
  
  return hasLatLng && hasMetric
}

function detectAllCoordinateTypes(record) {
  if (!record.coordinate) return ['unknown']
  const types = []
  const coordStr = String(record.coordinate)
  
  if (coordStr.includes(',') || coordStr.includes('°') || /\d{1,3}\.\d+,\s*\d{1,3}\.\d+/.test(coordStr)) {
    types.push('经纬度')
  }
  if (/[XYZxyz]:/.test(coordStr) || /^\d+(\.\d+)?$/.test(coordStr)) {
    types.push('米制')
  }
  
  return types.length > 0 ? types : ['unknown']
}

export const runAllSelfChecks = (records, unifiedResult) => {
  return {
    duplicateCheck: detectDuplicates(records),
    coordinateCheck: detectMixedCoordinates(records),
    recalculateCheck: recalculateAfterSupplement(records),
    exportConsistencyCheck: validateExportConsistency(records, unifiedResult),
    timestamp: new Date().toISOString()
  }
}
