const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, all } = require('../models/database');
const { EntityType } = require('./states');

function calculateDiff(before, after) {
  const diff = {};
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  for (const key of allKeys) {
    const beforeVal = before ? before[key] : undefined;
    const afterVal = after ? after[key] : undefined;
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = {
        before: beforeVal,
        after: afterVal
      };
    }
  }
  
  return Object.keys(diff).length > 0 ? diff : null;
}

function recordHistory(options) {
  const {
    entityType,
    entityId,
    action,
    fromStatus,
    toStatus,
    beforeData,
    afterData,
    operator = 'SYSTEM',
    reason,
    errorCode,
    errorMessage
  } = options;

  const diff = calculateDiff(beforeData, afterData);
  
  const id = uuidv4();
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO history (
      id, entity_type, entity_id, action, from_status, to_status,
      before_data, after_data, diff, operator, reason, error_code, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entityType,
      entityId,
      action,
      fromStatus,
      toStatus,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      diff ? JSON.stringify(diff) : null,
      operator,
      reason,
      errorCode,
      errorMessage,
      createdAt
    ]
  );

  return id;
}

function getHistory(entityType, entityId) {
  const records = all(
    `SELECT * FROM history 
     WHERE entity_type = ? AND entity_id = ? 
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );

  return records.map(r => ({
    ...r,
    before_data: r.before_data ? JSON.parse(r.before_data) : null,
    after_data: r.after_data ? JSON.parse(r.after_data) : null,
    diff: r.diff ? JSON.parse(r.diff) : null
  }));
}

function getDonationHistory(donationId) {
  return getHistory(EntityType.DONATION, donationId);
}

function getInvoiceHistory(invoiceId) {
  return getHistory(EntityType.INVOICE, invoiceId);
}

function getMergeRequestHistory(mergeRequestId) {
  return getHistory(EntityType.MERGE_REQUEST, mergeRequestId);
}

function getAllHistory(limit = 100) {
  const records = all(
    `SELECT * FROM history ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );

  return records.map(r => ({
    ...r,
    before_data: r.before_data ? JSON.parse(r.before_data) : null,
    after_data: r.after_data ? JSON.parse(r.after_data) : null,
    diff: r.diff ? JSON.parse(r.diff) : null
  }));
}

module.exports = {
  recordHistory,
  getHistory,
  getDonationHistory,
  getInvoiceHistory,
  getMergeRequestHistory,
  getAllHistory,
  calculateDiff
};
