const db = require('../config/database');

function createInspectionResult(inspectionData) {
  return new Promise((resolve, reject) => {
    const {
      call_id, has_apology, has_refund_promise, has_sensitive_word,
      sensitive_words, summary, anomaly_types
    } = inspectionData;
    
    db.run(
      `INSERT INTO inspection_results 
       (call_id, has_apology, has_refund_promise, has_sensitive_word, 
        sensitive_words, summary, anomaly_types) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [call_id, has_apology ? 1 : 0, has_refund_promise ? 1 : 0, 
       has_sensitive_word ? 1 : 0, sensitive_words, summary, anomaly_types],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...inspectionData });
      }
    );
  });
}

function getInspectionByCallId(callId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM inspection_results WHERE call_id = ?`, [callId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateReview(callId, reviewData) {
  return new Promise((resolve, reject) => {
    const { reviewed_by, review_status } = reviewData;
    db.run(
      `UPDATE inspection_results 
       SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_status = ? 
       WHERE call_id = ?`,
      [reviewed_by, review_status, callId],
      function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

function createBatchOperation(operationData) {
  return new Promise((resolve, reject) => {
    const { operation_type, total_count, success_count, failed_count, 
            success_ids, failed_ids, error_details } = operationData;
    
    db.run(
      `INSERT INTO batch_operations 
       (operation_type, total_count, success_count, failed_count, 
        success_ids, failed_ids, error_details) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [operation_type, total_count, success_count, failed_count,
       JSON.stringify(success_ids), JSON.stringify(failed_ids), 
       JSON.stringify(error_details)],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...operationData });
      }
    );
  });
}

function getBatchOperationById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM batch_operations WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else {
        if (row) {
          row.success_ids = JSON.parse(row.success_ids || '[]');
          row.failed_ids = JSON.parse(row.failed_ids || '[]');
          row.error_details = JSON.parse(row.error_details || '{}');
        }
        resolve(row);
      }
    });
  });
}

module.exports = {
  createInspectionResult,
  getInspectionByCallId,
  updateReview,
  createBatchOperation,
  getBatchOperationById
};
