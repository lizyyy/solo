const { db, getNextId, now } = require('../db/database');
const { generateNo, generateId } = require('../utils/id-generator');

class HistoryService {
  static createSnapshot(tableName, recordId, action, beforeData, afterData, operator = 'system') {
    db.data.history_snapshots.push({
      id: getNextId('history_snapshots'),
      snapshot_no: generateNo('HIST'),
      table_name: tableName,
      record_id: recordId,
      action: action,
      before_data: beforeData ? JSON.stringify(beforeData) : null,
      after_data: afterData ? JSON.stringify(afterData) : null,
      operator: operator,
      created_at: now()
    });
    return true;
  }
  
  static logOperation(operationType, targetType, targetId, operator, content, ip = null) {
    db.data.operation_logs.push({
      id: getNextId('operation_logs'),
      log_id: generateId(),
      operation_type: operationType,
      target_type: targetType,
      target_id: targetId,
      operator: operator,
      operation_content: content,
      ip_address: ip,
      created_at: now()
    });
    return true;
  }
  
  static getHistory(tableName, recordId, limit = 50) {
    return db.data.history_snapshots
      .filter(h => h.table_name === tableName && h.record_id === recordId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(row => ({
        ...row,
        before_data: row.before_data ? JSON.parse(row.before_data) : null,
        after_data: row.after_data ? JSON.parse(row.after_data) : null
      }));
  }
  
  static getOperationLogs(operationType = null, targetType = null, limit = 100) {
    let logs = [...db.data.operation_logs];
    if (operationType) {
      logs = logs.filter(l => l.operation_type === operationType);
    }
    if (targetType) {
      logs = logs.filter(l => l.target_type === targetType);
    }
    return logs
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  
  static getAuditTrailForStudent(studentId) {
    const logs = [];
    
    const transferLogs = db.data.transfer_applications
      .filter(ta => ta.student_id === studentId)
      .map(ta => ({
        type: 'transfer',
        reference_no: ta.application_no,
        status: ta.status,
        created_at: ta.created_at,
        description: ta.reason
      }));
    
    const feeLogs = db.data.fee_adjustments
      .filter(fa => fa.student_id === studentId)
      .map(fa => ({
        type: 'fee',
        reference_no: fa.adjustment_no,
        status: fa.reason,
        created_at: fa.created_at,
        description: fa.reason,
        adjustment_amount: fa.adjustment_amount
      }));
    
    const accessLogs = db.data.access_sync_logs
      .filter(asl => asl.student_id === studentId)
      .map(asl => ({
        type: 'access',
        reference_no: asl.sync_no,
        status: asl.sync_status,
        created_at: asl.synced_at,
        description: asl.sync_result
      }));
    
    logs.push(...transferLogs, ...feeLogs, ...accessLogs);
    logs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    
    return logs;
  }
}

module.exports = HistoryService;