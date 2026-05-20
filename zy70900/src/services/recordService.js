const db = require('../database/schema');
const moment = require('moment');

function logOperation(recordId, operationType, operator, reason, remark, sourceBatchId, previousStatus, newStatus) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs 
       (record_id, operation_type, operator, reason, remark, source_batch_id, previous_status, new_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, operationType, operator, reason, remark, sourceBatchId, previousStatus, newStatus],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function recordException(recordId, exceptionType, reason, handler, handleResult) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO exception_records 
       (record_id, exception_type, reason, handler, handle_result, is_resolved)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [recordId, exceptionType, reason, handler, handleResult],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getRecordById(recordId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM inspection_records WHERE id = ?`,
      [recordId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function updateRecordStatus(recordId, status, approvalStatus) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE inspection_records 
       SET status = ?, approval_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, approvalStatus, recordId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

async function processRecord(recordId, operator, reason, remark) {
  const record = await getRecordById(recordId);
  if (!record) {
    throw new Error('记录不存在');
  }

  const previousStatus = record.status;
  let exceptionType = null;
  let handleResult = '放行';

  const trialRunThreshold = 2;
  const approvalDueDays = 7;
  const inspectionDate = moment(record.inspection_date);
  const daysSinceInspection = moment().diff(inspectionDate, 'days');

  if (record.trial_run_hours < trialRunThreshold) {
    exceptionType = 'insufficient_trial_run';
    reason = reason || `试运行时长不足（当前${record.trial_run_hours}小时，要求${trialRunThreshold}小时）`;
  }

  if (record.is_key_item === 1) {
    const approval = await new Promise((resolve) => {
      db.get(
        `SELECT * FROM approval_forms WHERE record_id = ? ORDER BY created_at DESC LIMIT 1`,
        [recordId],
        (err, row) => {
          if (err) resolve(null);
          else resolve(row);
        }
      );
    });

    if (!approval || approval.is_signed === 0) {
      exceptionType = exceptionType ? `${exceptionType},unsigned_key_item` : 'unsigned_key_item';
      reason = reason || '关键项未签字确认';
    }
  }

  if (daysSinceInspection > approvalDueDays) {
    exceptionType = exceptionType ? `${exceptionType},overdue_approval` : 'overdue_approval';
    reason = reason || `超期放行（检修日期距今${daysSinceInspection}天，要求${approvalDueDays}天内完成）`;
    handleResult = '超期放行';
  }

  await updateRecordStatus(recordId, 'processed', 'approved');
  await logOperation(recordId, 'process', operator, reason, remark, record.batch_id, previousStatus, 'processed');

  if (exceptionType) {
    await recordException(recordId, exceptionType, reason, operator, handleResult);
  }

  return {
    success: true,
    recordId,
    status: 'processed',
    hasException: !!exceptionType,
    exceptionType,
    reason
  };
}

async function returnRecord(recordId, operator, reason, remark) {
  const record = await getRecordById(recordId);
  if (!record) {
    throw new Error('记录不存在');
  }

  const previousStatus = record.status;
  await updateRecordStatus(recordId, 'returned', 'rejected');
  await logOperation(recordId, 'return', operator, reason, remark, record.batch_id, previousStatus, 'returned');

  return {
    success: true,
    recordId,
    status: 'returned',
    reason
  };
}

async function requestSupplement(recordId, operator, reason, remark) {
  const record = await getRecordById(recordId);
  if (!record) {
    throw new Error('记录不存在');
  }

  const previousStatus = record.status;
  await updateRecordStatus(recordId, 'supplement', 'pending');
  await logOperation(recordId, 'supplement', operator, reason, remark, record.batch_id, previousStatus, 'supplement');

  return {
    success: true,
    recordId,
    status: 'supplement',
    reason
  };
}

function queryRecords(filters) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        r.*,
        b.batch_no,
        b.created_by as batch_created_by,
        b.created_at as batch_created_at
      FROM inspection_records r
      LEFT JOIN batches b ON r.batch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.cableCarNo) {
      sql += ` AND r.cable_car_no LIKE ?`;
      params.push(`%${filters.cableCarNo}%`);
    }

    if (filters.inspectionItem) {
      sql += ` AND r.inspection_item LIKE ?`;
      params.push(`%${filters.inspectionItem}%`);
    }

    if (filters.status) {
      sql += ` AND r.status = ?`;
      params.push(filters.status);
    }

    if (filters.startDate) {
      sql += ` AND r.inspection_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ` AND r.inspection_date <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY r.created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getRecordTrace(recordId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
         ol.*,
         r.record_no,
         r.cable_car_no,
         r.inspection_item,
         b.batch_no,
         b.source_file
       FROM operation_logs ol
       LEFT JOIN inspection_records r ON ol.record_id = r.id
       LEFT JOIN batches b ON ol.source_batch_id = b.id
       WHERE ol.record_id = ?
       ORDER BY ol.operation_time ASC`,
      [recordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getOperationLogByOperator(operator, limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
         ol.*,
         r.record_no,
         r.cable_car_no,
         r.inspection_item,
         b.batch_no
       FROM operation_logs ol
       LEFT JOIN inspection_records r ON ol.record_id = r.id
       LEFT JOIN batches b ON ol.source_batch_id = b.id
       WHERE ol.operator LIKE ?
       ORDER BY ol.operation_time DESC
       LIMIT ?`,
      [`%${operator}%`, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getExceptions(recordId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM exception_records WHERE record_id = ? ORDER BY handle_time ASC`,
      [recordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  processRecord,
  returnRecord,
  requestSupplement,
  queryRecords,
  getRecordById,
  getRecordTrace,
  getOperationLogByOperator,
  getExceptions,
  logOperation,
  recordException
};
