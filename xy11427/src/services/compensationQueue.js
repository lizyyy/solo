const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDatabase } = require('../config/database');
const { recordOperation } = require('./operationHistory');

const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  RETRYING: 'retrying',
  MANUAL: 'manual',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const MAX_RETRIES = 5;
const RETRY_DELAY_MINUTES = [1, 5, 15, 30, 60];

function addToQueue(recordType, recordNo, factId, options = {}) {
  const db = getDatabase();
  const queueId = `queue_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  
  const stmt = db.prepare(`
    INSERT INTO compensation_queue (
      queue_id, fact_id, record_type, record_no, status,
      retry_count, max_retries, priority, next_retry_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  const nextRetry = moment().add(1, 'minute').toISOString();
  
  stmt.run(
    queueId,
    factId,
    recordType,
    recordNo,
    QUEUE_STATUS.PENDING,
    0,
    options.maxRetries || MAX_RETRIES,
    options.priority || 5,
    nextRetry,
    options.createdBy || 'system',
    now,
    now
  );
  
  recordOperation(
    factId,
    queueId,
    null,
    'queue_add',
    options.createdBy || 'system',
    null,
    JSON.stringify({ recordType, recordNo }),
    '记录加入补偿队列'
  );
  
  return queueId;
}

function getNextBatch(limit = 10) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    SELECT * FROM compensation_queue
    WHERE status IN ('pending', 'retrying')
      AND next_retry_at <= ?
      AND retry_count < max_retries
    ORDER BY priority DESC, next_retry_at ASC
    LIMIT ?
  `);
  
  return stmt.all(now, limit);
}

function processRetry(queueId) {
  const db = getDatabase();
  
  const queueItem = db.prepare(`
    SELECT * FROM compensation_queue WHERE queue_id = ?
  `).get(queueId);
  
  if (!queueItem) {
    throw new Error('队列项不存在');
  }
  
  const newRetryCount = queueItem.retry_count + 1;
  const delayIndex = Math.min(newRetryCount - 1, RETRY_DELAY_MINUTES.length - 1);
  const nextRetry = moment().add(RETRY_DELAY_MINUTES[delayIndex], 'minutes').toISOString();
  const now = new Date().toISOString();
  
  let newStatus = QUEUE_STATUS.RETRYING;
  let retryable = 1;
  
  if (newRetryCount >= queueItem.max_retries) {
    newStatus = QUEUE_STATUS.MANUAL;
    retryable = 0;
    moveToDeadLetter(queueItem);
  }
  
  const stmt = db.prepare(`
    UPDATE compensation_queue
    SET status = ?,
        retry_count = ?,
        last_retry_at = ?,
        next_retry_at = ?,
        retryable = ?,
        updated_at = ?
    WHERE queue_id = ?
  `);
  
  stmt.run(newStatus, newRetryCount, now, nextRetry, retryable, now, queueId);
  
  recordOperation(
    queueItem.fact_id,
    queueId,
    null,
    'queue_retry',
    'system',
    JSON.stringify({ retry_count: queueItem.retry_count }),
    JSON.stringify({ retry_count: newRetryCount, status: newStatus }),
    `第 ${newRetryCount} 次重试`
  );
  
  return {
    queueId,
    newStatus,
    retryCount: newRetryCount,
    nextRetry
  };
}

function markCompleted(queueId, operator = 'system') {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const queueItem = db.prepare(`
    SELECT * FROM compensation_queue WHERE queue_id = ?
  `).get(queueId);
  
  const stmt = db.prepare(`
    UPDATE compensation_queue
    SET status = ?,
        completed_at = ?,
        updated_at = ?
    WHERE queue_id = ?
  `);
  
  stmt.run(QUEUE_STATUS.COMPLETED, now, now, queueId);
  
  recordOperation(
    queueItem.fact_id,
    queueId,
    null,
    'queue_complete',
    operator,
    JSON.stringify({ status: queueItem.status }),
    JSON.stringify({ status: QUEUE_STATUS.COMPLETED }),
    '补偿处理完成'
  );
  
  return true;
}

function markFailed(queueId, errorMessage, errorCode = null) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const queueItem = db.prepare(`
    SELECT * FROM compensation_queue WHERE queue_id = ?
  `).get(queueId);
  
  const stmt = db.prepare(`
    UPDATE compensation_queue
    SET status = ?,
        error_message = ?,
        error_code = ?,
        updated_at = ?
    WHERE queue_id = ?
  `);
  
  stmt.run(QUEUE_STATUS.FAILED, errorMessage, errorCode, now, queueId);
  
  recordOperation(
    queueItem.fact_id,
    queueId,
    null,
    'queue_failed',
    'system',
    null,
    JSON.stringify({ error: errorMessage, error_code: errorCode }),
    `处理失败: ${errorMessage}`
  );
  
  return true;
}

function assignToManual(queueId, assignedTo, notes = '') {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const queueItem = db.prepare(`
    SELECT * FROM compensation_queue WHERE queue_id = ?
  `).get(queueId);
  
  const stmt = db.prepare(`
    UPDATE compensation_queue
    SET status = ?,
        assigned_to = ?,
        retryable = 0,
        updated_at = ?
    WHERE queue_id = ?
  `);
  
  stmt.run(QUEUE_STATUS.MANUAL, assignedTo, now, queueId);
  
  recordOperation(
    queueItem.fact_id,
    queueId,
    null,
    'queue_assign_manual',
    'system',
    JSON.stringify({ status: queueItem.status, assigned_to: queueItem.assigned_to }),
    JSON.stringify({ status: QUEUE_STATUS.MANUAL, assigned_to: assignedTo }),
    notes || '转人工处理'
  );
  
  return true;
}

function moveToDeadLetter(queueItem) {
  const db = getDatabase();
  const dlqId = `dlq_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  
  const stmt = db.prepare(`
    INSERT INTO dead_letter_queue (
      queue_id, original_queue_id, fact_id, record_type,
      record_no, final_error, retry_count, moved_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dead')
  `);
  
  stmt.run(
    dlqId,
    queueItem.queue_id,
    queueItem.fact_id,
    queueItem.record_type,
    queueItem.record_no,
    queueItem.error_message || '超过最大重试次数',
    queueItem.retry_count,
    new Date().toISOString()
  );
  
  return dlqId;
}

function recoverFromDeadLetter(dlqId, operator = 'system') {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const dlqItem = db.prepare(`
    SELECT * FROM dead_letter_queue WHERE queue_id = ?
  `).get(dlqId);
  
  if (!dlqItem) {
    throw new Error('死信记录不存在');
  }
  
  db.prepare(`
    UPDATE dead_letter_queue
    SET status = 'recovered',
        recovered_at = ?
    WHERE queue_id = ?
  `).run(now, dlqId);
  
  db.prepare(`
    UPDATE compensation_queue
    SET status = 'retrying',
        retry_count = 0,
        next_retry_at = ?,
        retryable = 1,
        updated_at = ?
    WHERE queue_id = ?
  `).run(now, now, dlqItem.original_queue_id);
  
  recordOperation(
    dlqItem.fact_id,
    dlqItem.original_queue_id,
    null,
    'dlq_recover',
    operator,
    JSON.stringify({ dlq_status: 'dead' }),
    JSON.stringify({ dlq_status: 'recovered', queue_status: 'retrying' }),
    '从死信队列恢复'
  );
  
  return true;
}

function getQueueStats() {
  const db = getDatabase();
  
  const stats = db.prepare(`
    SELECT 
      status,
      retryable,
      COUNT(*) as count
    FROM compensation_queue
    GROUP BY status, retryable
    ORDER BY status, retryable
  `).all();
  
  const dlqStats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM dead_letter_queue
    GROUP BY status
  `).all();
  
  const retryableByType = db.prepare(`
    SELECT 
      record_type,
      COUNT(*) as count
    FROM compensation_queue
    WHERE status IN ('pending', 'retrying')
      AND retryable = 1
    GROUP BY record_type
  `).all();
  
  return {
    queue: stats,
    deadLetter: dlqStats,
    retryableByType
  };
}

module.exports = {
  QUEUE_STATUS,
  addToQueue,
  getNextBatch,
  processRetry,
  markCompleted,
  markFailed,
  assignToManual,
  moveToDeadLetter,
  recoverFromDeadLetter,
  getQueueStats
};
