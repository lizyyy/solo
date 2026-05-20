const db = require('../config/database');
const moment = require('moment');

const createBatch = async (batchData) => {
  const batchNo = `BATCH${moment().format('YYYYMMDDHHmmss')}`;
  
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO batches (batch_no, name, period_start, period_end, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      batchNo,
      batchData.name,
      batchData.period_start,
      batchData.period_end,
      batchData.created_by,
      'pending'
    ], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, batch_no: batchNo });
    });
  });
};

const getBatches = async (filters = {}) => {
  let query = `SELECT * FROM batches WHERE 1=1`;
  const params = [];
  
  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }
  
  if (filters.period_start) {
    query += ` AND period_start >= ?`;
    params.push(filters.period_start);
  }
  
  if (filters.period_end) {
    query += ` AND period_end <= ?`;
    params.push(filters.period_end);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getBatchById = async (batchId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM batches WHERE id = ?', [batchId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const processReading = async (readingId, action, reason, processedBy, remarks = '') => {
  const validActions = ['approve', 'reject', 'return', 'manual_fix'];
  if (!validActions.includes(action)) {
    throw new Error('无效的处理动作');
  }

  const statusMap = {
    'approve': 'approved',
    'reject': 'rejected',
    'return': 'returned',
    'manual_fix': 'fixed'
  };

  await new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO processing_records (reading_id, action, reason, processed_by, remarks)
      VALUES (?, ?, ?, ?, ?)
    `, [readingId, action, reason, processedBy, remarks], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise((resolve, reject) => {
    db.run(`
      UPDATE meter_readings SET status = ? WHERE id = ?
    `, [statusMap[action], readingId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return { success: true, status: statusMap[action] };
};

const returnForRevision = async (readingId, reason, processedBy) => {
  return processReading(readingId, 'return', reason, processedBy, '退回修改');
};

const approveReading = async (readingId, reason, processedBy) => {
  return processReading(readingId, 'approve', reason, processedBy, '审核通过');
};

const manualFix = async (readingId, reason, processedBy, correctedData) => {
  if (correctedData) {
    await new Promise((resolve, reject) => {
      const updates = [];
      const params = [];
      
      if (correctedData.consumption !== undefined) {
        updates.push('consumption = ?');
        params.push(correctedData.consumption);
      }
      if (correctedData.multiplier !== undefined) {
        updates.push('multiplier = ?');
        params.push(correctedData.multiplier);
      }
      if (correctedData.actual_consumption !== undefined) {
        updates.push('actual_consumption = ?');
        params.push(correctedData.actual_consumption);
      }
      if (correctedData.peak_reason !== undefined) {
        updates.push('peak_reason = ?');
        params.push(correctedData.peak_reason);
      }
      if (correctedData.vacant_reason !== undefined) {
        updates.push('vacant_reason = ?');
        params.push(correctedData.vacant_reason);
      }
      
      params.push(readingId);
      
      db.run(`
        UPDATE meter_readings SET ${updates.join(', ')} WHERE id = ?
      `, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return processReading(readingId, 'manual_fix', reason, processedBy, '人工修正完成');
};

const getProcessingHistory = async (readingId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT pr.*, mr.status as current_status
      FROM processing_records pr
      LEFT JOIN meter_readings mr ON pr.reading_id = mr.id
      WHERE pr.reading_id = ?
      ORDER BY pr.processed_at DESC
    `, [readingId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  processReading,
  returnForRevision,
  approveReading,
  manualFix,
  getProcessingHistory
};
