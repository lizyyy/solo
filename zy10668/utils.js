const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const REWORK_STATUSES = {
  PENDING_PRODUCTION: 'pending_production',
  IN_REWORK: 'in_rework',
  PENDING_REVIEW: 'pending_review',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CONFLICT: 'conflict'
};

const STATUS_LABELS = {
  pending_production: '待生产',
  in_rework: '返工中',
  pending_review: '待复检',
  rejected: '已驳回',
  completed: '已完成',
  conflict: '状态冲突'
};

const OPERATION_TYPES = {
  CREATE: 'create',
  START: 'start',
  SUBMIT: 'submit',
  REVIEW: 'review',
  REJECT: 'reject',
  COMPLETE: 'complete',
  MANUAL_OVERRIDE: 'manual_override',
  CONFLICT_RESOLVE: 'conflict_resolve'
};

function generateReworkNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `RW${year}${month}${day}${random}`;
}

function generateBatchNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `IMP${year}${month}${day}${random}`;
}

function recordStatusHistory(reworkTaskId, fromStatus, toStatus, operationType, operator, remark, callback) {
  const historyId = uuidv4();
  const sql = `INSERT INTO rework_status_history 
    (id, rework_task_id, from_status, to_status, operation_type, operator, remark) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [historyId, reworkTaskId, fromStatus, toStatus, operationType, operator, remark], callback);
}

function updateReworkStatus(reworkTaskId, newStatus, operator, remark, operationType, callback) {
  db.get('SELECT status FROM rework_tasks WHERE id = ?', [reworkTaskId], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(new Error('返工任务不存在'));

    const fromStatus = row.status;
    const sql = `UPDATE rework_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, [newStatus, reworkTaskId], (err) => {
      if (err) return callback(err);
      recordStatusHistory(reworkTaskId, fromStatus, newStatus, operationType, operator, remark, callback);
    });
  });
}

function validateStatusTransition(fromStatus, toStatus) {
  const validTransitions = {
    pending_production: ['in_rework', 'rejected'],
    in_rework: ['pending_review', 'conflict'],
    pending_review: ['completed', 'rejected', 'conflict'],
    rejected: ['pending_production', 'in_rework'],
    conflict: ['pending_review', 'in_rework', 'completed'],
    completed: []
  };
  
  return validTransitions[fromStatus]?.includes(toStatus) || false;
}

module.exports = {
  REWORK_STATUSES,
  STATUS_LABELS,
  OPERATION_TYPES,
  generateReworkNo,
  generateBatchNo,
  recordStatusHistory,
  updateReworkStatus,
  validateStatusTransition
};
