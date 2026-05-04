const { runQuery, allQuery, getQuery, uuidv4 } = require('./database');
const { broadcastLogEntry } = require('./websocket');

const LOG_SEVERITY = {
  debug: 'debug',
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical'
};

const LOG_ACTIONS = {
  patient_created: '患者创建',
  patient_updated: '患者更新',
  patient_deleted: '患者删除',
  patient_triage_changed: '分诊级别变更',
  patient_status_changed: '状态变更',
  bed_occupied: '床位占用',
  bed_released: '床位释放',
  bed_conflict: '床位冲突',
  transfer_requested: '转运请求',
  transfer_completed: '转运完成',
  transfer_missed: '转运漏看',
  department_capacity_warning: '科室容量告警',
  wait_timeout: '等待超时',
  triage_error: '分诊错误',
  ambulance_arrived: '救护车到达',
  ambulance_departed: '救护车出发',
  drill_started: '演练开始',
  drill_ended: '演练结束',
  data_imported: '数据导入',
  data_exported: '数据导出',
  manual_check: '手动检查',
  system_error: '系统错误'
};

async function logAction(action, entityType, entityId, details = {}, operator = 'system', severity = LOG_SEVERITY.info) {
  const timestamp = new Date().toISOString();
  const logId = uuidv4();
  
  const logEntry = {
    id: logId,
    timestamp,
    operator,
    action,
    entityType,
    entityId,
    details: JSON.stringify(details),
    severity
  };
  
  try {
    await runQuery(`
      INSERT INTO operation_logs (id, timestamp, operator, action, entityType, entityId, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [logId, timestamp, operator, action, entityType, entityId, JSON.stringify(details), severity]);
    
    // 广播日志条目
    const broadcastData = {
      ...logEntry,
      details: details,
      actionLabel: LOG_ACTIONS[action] || action
    };
    broadcastLogEntry(broadcastData);
    
    return logEntry;
  } catch (error) {
    console.error('写入日志失败:', error);
    return null;
  }
}

async function getLogs(options = {}) {
  const { 
    limit = 100, 
    offset = 0, 
    severity, 
    action, 
    entityType, 
    startTime, 
    endTime,
    operator
  } = options;
  
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];
  
  if (severity) {
    sql += ' AND severity = ?';
    params.push(severity);
  }
  
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  
  if (entityType) {
    sql += ' AND entityType = ?';
    params.push(entityType);
  }
  
  if (startTime) {
    sql += ' AND timestamp >= ?';
    params.push(startTime);
  }
  
  if (endTime) {
    sql += ' AND timestamp <= ?';
    params.push(endTime);
  }
  
  if (operator) {
    sql += ' AND operator = ?';
    params.push(operator);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  try {
    const logs = await allQuery(sql, params);
    
    // 解析 details 并添加 actionLabel
    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details || '{}'),
      actionLabel: LOG_ACTIONS[log.action] || log.action
    }));
  } catch (error) {
    console.error('查询日志失败:', error);
    return [];
  }
}

async function getLogStats(options = {}) {
  const { startTime, endTime } = options;
  
  let sql = `
    SELECT 
      severity,
      COUNT(*) as count
    FROM operation_logs 
    WHERE 1=1
  `;
  const params = [];
  
  if (startTime) {
    sql += ' AND timestamp >= ?';
    params.push(startTime);
  }
  
  if (endTime) {
    sql += ' AND timestamp <= ?';
    params.push(endTime);
  }
  
  sql += ' GROUP BY severity ORDER BY count DESC';
  
  try {
    const severityStats = await allQuery(sql, params);
    
    // 获取总条数
    let countSql = 'SELECT COUNT(*) as total FROM operation_logs WHERE 1=1';
    const countParams = [];
    
    if (startTime) {
      countSql += ' AND timestamp >= ?';
      countParams.push(startTime);
    }
    
    if (endTime) {
      countSql += ' AND timestamp <= ?';
      countParams.push(endTime);
    }
    
    const totalResult = await getQuery(countSql, countParams);
    
    return {
      total: totalResult?.total || 0,
      bySeverity: severityStats
    };
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return { total: 0, bySeverity: [] };
  }
}

// 便捷的日志函数
async function logPatientCreated(patient, operator = 'system') {
  return logAction(
    'patient_created',
    'patient',
    patient.id,
    { 
      name: patient.name, 
      triageLevel: patient.triageLevel,
      chiefComplaint: patient.chiefComplaint
    },
    operator,
    LOG_SEVERITY.info
  );
}

async function logPatientTriageChanged(patient, oldLevel, newLevel, operator = 'system') {
  return logAction(
    'patient_triage_changed',
    'patient',
    patient.id,
    { 
      name: patient.name, 
      oldLevel, 
      newLevel,
      chiefComplaint: patient.chiefComplaint
    },
    operator,
    oldLevel === 'green' && newLevel === 'red' ? LOG_SEVERITY.critical : LOG_SEVERITY.warning
  );
}

async function logWaitTimeout(patient, waitTime, threshold, operator = 'system') {
  return logAction(
    'wait_timeout',
    'patient',
    patient.id,
    { 
      name: patient.name, 
      triageLevel: patient.triageLevel,
      waitTime,
      threshold,
      excessMinutes: waitTime - threshold
    },
    operator,
    patient.triageLevel === 'red' ? LOG_SEVERITY.critical : LOG_SEVERITY.warning
  );
}

async function logTransferMissed(transfer, waitTime, threshold, operator = 'system') {
  return logAction(
    'transfer_missed',
    'transfer',
    transfer.id,
    { 
      patientId: transfer.patientId,
      patientName: transfer.patientName,
      queuePosition: transfer.queuePosition,
      waitTime,
      threshold
    },
    operator,
    LOG_SEVERITY.error
  );
}

async function logBedConflict(bed, patientId, reason, operator = 'system') {
  return logAction(
    'bed_conflict',
    'bed',
    bed.id,
    { 
      bedNumber: bed.bedNumber,
      patientId,
      occupiedBy: bed.patientId,
      reason
    },
    operator,
    LOG_SEVERITY.error
  );
}

async function logIncident(incident, operator = 'system') {
  const severityMap = {
    warning: LOG_SEVERITY.warning,
    error: LOG_SEVERITY.error,
    critical: LOG_SEVERITY.critical
  };
  
  return logAction(
    'incident',
    'incident',
    incident.id,
    { 
      type: incident.type,
      description: incident.description,
      patientId: incident.patientId
    },
    operator,
    severityMap[incident.severity] || LOG_SEVERITY.warning
  );
}

module.exports = {
  LOG_SEVERITY,
  LOG_ACTIONS,
  logAction,
  getLogs,
  getLogStats,
  logPatientCreated,
  logPatientTriageChanged,
  logWaitTimeout,
  logTransferMissed,
  logBedConflict,
  logIncident
};
