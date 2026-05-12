import { v4 as uuidv4 } from 'uuid';
import store from '../store.js';
import { STAGES, updateBusinessStatus, updateDataSummary, addProblem } from '../utils/status.js';

const MUSEUM_OPENING_HOURS = {
  open: { hour: 9, minute: 0 },
  close: { hour: 18, minute: 0 }
};

function isValidStopPoint(point, index) {
  const errors = [];
  const warnings = [];
  
  if (typeof point.visitorId !== 'string' || point.visitorId.trim() === '') {
    errors.push('观众ID缺失或格式无效');
  }
  
  if (typeof point.x !== 'number' || isNaN(point.x) || point.x < 0 || point.x > 1000) {
    errors.push('X坐标无效，必须在0-1000范围内');
  }
  
  if (typeof point.y !== 'number' || isNaN(point.y) || point.y < 0 || point.y > 800) {
    errors.push('Y坐标无效，必须在0-800范围内');
  }
  
  if (typeof point.duration !== 'number' || isNaN(point.duration) || point.duration < 0) {
    errors.push('停留时长无效，必须为非负整数');
  } else if (point.duration > 7200) {
    warnings.push(`停留时长过长 (${point.duration}秒)，可能为异常数据`);
  }
  
  if (!point.timestamp) {
    errors.push('时间戳缺失');
  } else {
    const timestamp = new Date(point.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push('时间戳格式无效');
    } else {
      const hour = timestamp.getHours();
      const minute = timestamp.getMinutes();
      const timeValue = hour * 60 + minute;
      const openTime = MUSEUM_OPENING_HOURS.open.hour * 60 + MUSEUM_OPENING_HOURS.open.minute;
      const closeTime = MUSEUM_OPENING_HOURS.close.hour * 60 + MUSEUM_OPENING_HOURS.close.minute;
      
      if (timeValue < openTime || timeValue > closeTime) {
        warnings.push(`时间戳不在开馆时间内 (${timestamp.toTimeString()})`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    severity: errors.length > 0 ? 'error' : (warnings.length > 0 ? 'warning' : 'info')
  };
}

function normalizeStopPoint(point) {
  return {
    visitorId: point.visitorId ? point.visitorId.trim() : '',
    x: Number(point.x),
    y: Number(point.y),
    duration: Number(point.duration),
    timestamp: point.timestamp ? new Date(point.timestamp).toISOString() : null,
    zoneId: point.zoneId || null,
    exhibitionId: point.exhibitionId || null
  };
}

function importStopPoints(rawData, source = 'manual_upload') {
  updateBusinessStatus(STAGES.DATA_IMPORT, null, ['开始导入观众停留点数据']);
  
  const result = {
    success: false,
    imported: 0,
    invalid: 0,
    warnings: 0,
    problems: [],
    message: ''
  };
  
  if (!Array.isArray(rawData)) {
    addProblem('data_format', 'error', source, '导入数据格式错误，必须为数组', rawData);
    result.message = '数据格式错误，必须为数组';
    updateBusinessStatus(STAGES.DATA_IMPORT, 'invalid_format', ['请检查数据格式是否正确']);
    return result;
  }
  
  const suggestions = [];
  
  for (let i = 0; i < rawData.length; i++) {
    const rawPoint = rawData[i];
    const normalized = normalizeStopPoint(rawPoint);
    const validation = isValidStopPoint(normalized, i);
    
    const stopPoint = {
      id: uuidv4(),
      rawData: rawPoint,
      normalizedData: normalized,
      status: validation.isValid ? 'valid' : 'invalid',
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      source,
      importedAt: new Date().toISOString(),
      processed: false
    };
    
    store.stopPoints.push(stopPoint);
    
    if (validation.isValid) {
      result.imported++;
      if (validation.warnings.length > 0) {
        result.warnings++;
        addProblem('data_warning', 'warning', source, validation.warnings.join('; '), rawPoint);
        suggestions.push(`第${i+1}条数据: ${validation.warnings.join('; ')}`);
      }
    } else {
      result.invalid++;
      const problem = addProblem('data_invalid', 'error', source, validation.errors.join('; '), rawPoint);
      result.problems.push(problem);
    }
  }
  
  const uploadRecord = {
    id: uuidv4(),
    source,
    timestamp: new Date().toISOString(),
    totalRecords: rawData.length,
    validRecords: result.imported,
    invalidRecords: result.invalid,
    warningRecords: result.warnings
  };
  
  store.uploadHistory.push(uploadRecord);
  updateDataSummary();
  
  if (result.invalid > 0) {
    suggestions.push(`发现 ${result.invalid} 条无效数据，请查看问题列表处理`);
  }
  
  if (result.imported > 0) {
    suggestions.push(`成功导入 ${result.imported} 条有效数据，建议继续配置展区分组`);
  }
  
  result.success = result.imported > 0;
  result.message = result.success 
    ? `导入完成：有效 ${result.imported} 条，无效 ${result.invalid} 条，警告 ${result.warnings} 条`
    : `导入失败：所有 ${rawData.length} 条数据均无效`;
  
  const nextStage = result.success ? STAGES.EXHIBITION_GROUPING : STAGES.IDLE;
  const block = result.imported === 0 ? 'all_invalid' : null;
  
  updateBusinessStatus(nextStage, block, suggestions);
  
  return result;
}

function getImportHistory() {
  return store.uploadHistory;
}

function getStopPoints(filters = {}) {
  let points = [...store.stopPoints];
  
  if (filters.status) {
    points = points.filter(p => p.status === filters.status);
  }
  
  if (filters.source) {
    points = points.filter(p => p.source === filters.source);
  }
  
  return points;
}

export {
  importStopPoints,
  getImportHistory,
  getStopPoints,
  isValidStopPoint
};
