const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');

const workflowTransitions = {
  [config.workflow.DRAFT]: [config.workflow.SUBMITTED],
  [config.workflow.SUBMITTED]: [config.workflow.CONFIRMED, config.workflow.REJECTED],
  [config.workflow.REJECTED]: [config.workflow.SUBMITTED],
  [config.workflow.CONFIRMED]: [config.workflow.AUDITED],
  [config.workflow.AUDITED]: [],
};

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = workflowTransitions[fromStatus];
  return allowedTransitions && allowedTransitions.includes(toStatus);
}

function recordWorkflow(tableName, recordId, fromStatus, toStatus, action, remark, operator) {
  const db = getDatabase();
  
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`不允许从 ${fromStatus} 转换到 ${toStatus}`);
  }

  const stmt = db.prepare(`
    INSERT INTO workflow_records (id, table_name, record_id, from_status, to_status, action, remark, operator_id, operator_name, operator_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuidv4(),
    tableName,
    recordId,
    fromStatus,
    toStatus,
    action,
    remark,
    operator.id,
    operator.name,
    operator.role,
    dayjs().valueOf()
  );

  return true;
}

function getWorkflowHistory(tableName, recordId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM workflow_records
    WHERE table_name = ? AND record_id = ?
    ORDER BY created_at ASC
  `);

  const rows = stmt.all(tableName, recordId);
  
  return rows.map(row => ({
    ...row,
    created_at: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function submitRecord(tableName, recordId, currentStatus, operator, remark = null) {
  return recordWorkflow(
    tableName,
    recordId,
    currentStatus,
    config.workflow.SUBMITTED,
    'submit',
    remark,
    operator
  );
}

function rejectRecord(tableName, recordId, currentStatus, operator, remark = null) {
  return recordWorkflow(
    tableName,
    recordId,
    currentStatus,
    config.workflow.REJECTED,
    'reject',
    remark,
    operator
  );
}

function confirmRecord(tableName, recordId, currentStatus, operator, remark = null) {
  return recordWorkflow(
    tableName,
    recordId,
    currentStatus,
    config.workflow.CONFIRMED,
    'confirm',
    remark,
    operator
  );
}

function auditRecord(tableName, recordId, currentStatus, operator, remark = null) {
  return recordWorkflow(
    tableName,
    recordId,
    currentStatus,
    config.workflow.AUDITED,
    'audit',
    remark,
    operator
  );
}

module.exports = {
  canTransition,
  recordWorkflow,
  getWorkflowHistory,
  submitRecord,
  rejectRecord,
  confirmRecord,
  auditRecord,
  workflowTransitions,
};
