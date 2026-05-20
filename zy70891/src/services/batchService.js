const db = require('../config/database');
const { generateBatchHash, generateBatchId } = require('../utils/hash');
const { classifyBatch, RESULT_TYPES } = require('./classificationService');
const moment = require('moment');

function findDuplicateBatch(batchHash) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM batches WHERE batch_hash = ?',
      [batchHash],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function insertBatch(batchId, batchHash, submitter, stats) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO batches (id, batch_hash, submitter, total_records, normal_count, pending_count, blocked_count, status, processed_at, processed_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, ?)`,
      [batchId, batchHash, submitter, stats.total, stats.normal, stats.pending, stats.blocked, submitter],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function insertCheckinRecord(batchId, record) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO checkin_records 
      (batch_id, object_id, object_name, checkin_date, risk_level, has_checkin, checkin_source, 
       has_leave, leave_start_date, leave_end_date, leave_approved, location_gap_hours, location_sources, location_abnormal, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        record.object_id,
        record.object_name,
        record.checkin_date,
        record.risk_level,
        record.has_checkin ? 1 : 0,
        record.checkin_source || null,
        record.has_leave ? 1 : 0,
        record.leave_start_date || null,
        record.leave_end_date || null,
        record.leave_approved ? 1 : 0,
        record.location_gap_hours || 0,
        record.location_sources || null,
        record.location_abnormal ? 1 : 0,
        JSON.stringify(record)
      ],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function insertProcessingResult(batchId, recordId, result, processedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO processing_results 
      (batch_id, record_id, object_id, object_name, checkin_date, result_type, reason, follow_up_action, processed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        recordId,
        result.object_id,
        result.object_name,
        result.checkin_date,
        result.resultType,
        result.reason,
        result.followUpAction,
        processedBy
      ],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function insertDailySummary(batchId, result, processedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO daily_summaries 
      (summary_date, batch_id, object_id, object_name, risk_level, checkin_status, checkin_sources, 
       leave_status, leave_coverage, location_status, location_gap_hours, location_sources, final_result, final_reason, processed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.checkin_date,
        batchId,
        result.object_id,
        result.object_name,
        result.risk_level,
        result.checkinStatus,
        result.checkin_source || '',
        result.leaveStatus,
        result.has_leave ? `${result.leave_start_date}至${result.leave_end_date}` : '',
        result.locationStatus,
        result.location_gap_hours || 0,
        result.location_sources || '',
        result.resultType,
        result.reason,
        processedBy
      ],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function processBatch(submitter, records) {
  const batchHash = generateBatchHash(records);
  const duplicate = await findDuplicateBatch(batchHash);

  if (duplicate) {
    const existingResults = await getBatchResults(duplicate.id);
    return {
      isDuplicate: true,
      batchId: duplicate.id,
      batch: duplicate,
      results: existingResults
    };
  }

  const batchId = generateBatchId();
  const { results: classifiedResults, stats } = classifyBatch(records);

  await insertBatch(batchId, batchHash, submitter, stats);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const classified = classifiedResults[i];
    
    const recordId = await insertCheckinRecord(batchId, record);
    await insertProcessingResult(batchId, recordId, classified, submitter);
    await insertDailySummary(batchId, classified, submitter);
  }

  return {
    isDuplicate: false,
    batchId,
    stats,
    results: classifiedResults
  };
}

function getBatch(batchId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM batches WHERE id = ?', [batchId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getBatchResults(batchId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM processing_results WHERE batch_id = ?', [batchId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getDailySummaries(batchId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM daily_summaries WHERE batch_id = ? ORDER BY summary_date, object_id', [batchId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getBatchStats(batchId) {
  return new Promise(async (resolve, reject) => {
    const batch = await getBatch(batchId);
    if (!batch) {
      resolve(null);
      return;
    }

    db.all(`
      SELECT 
        result_type,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT object_id) as object_ids
      FROM processing_results 
      WHERE batch_id = ?
      GROUP BY result_type
    `, [batchId], (err, rows) => {
      if (err) reject(err);
      else {
        const stats = {
          batch,
          byType: {}
        };
        rows.forEach(row => {
          stats.byType[row.result_type] = {
            count: row.count,
            object_ids: row.object_ids ? row.object_ids.split(',') : []
          };
        });
        resolve(stats);
      }
    });
  });
}

function listBatches(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM batches ORDER BY submitted_at DESC LIMIT ?', [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  processBatch,
  getBatch,
  getBatchResults,
  getDailySummaries,
  getBatchStats,
  listBatches
};
