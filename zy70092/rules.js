const { getDb, saveDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

const ITEM_STATUSES = {
  REGISTERED: 'REGISTERED',
  IN_TRANSIT: 'IN_TRANSIT',
  IN_STORAGE: 'IN_STORAGE',
  CLAIM_PENDING: 'CLAIM_PENDING',
  CLAIMED: 'CLAIMED',
  OVERDUE_NOTICE: 'OVERDUE_NOTICE',
  DONATED: 'DONATED',
  DISCARDED: 'DISCARDED'
};

const CLAIM_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PICKED_UP: 'PICKED_UP'
};

function getRuleValue(ruleName) {
  const db = getDb();
  const result = db.exec('SELECT value FROM rules WHERE name = ?', [ruleName]);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

function getAllRules() {
  const db = getDb();
  const result = db.exec('SELECT * FROM rules ORDER BY name');
  return rowsToObjects(result);
}

function updateRule(ruleName, newValue, performedBy) {
  const db = getDb();
  const oldResult = db.exec('SELECT value FROM rules WHERE name = ?', [ruleName]);
  
  if (oldResult.length === 0 || oldResult[0].values.length === 0) {
    throw new Error(`规则不存在: ${ruleName}`);
  }
  
  const oldValue = oldResult[0].values[0][0];
  
  db.run('UPDATE rules SET value = ?, updated_at = datetime(\'now\') WHERE name = ?', [newValue, ruleName]);
  
  addAuditLog('UPDATE_RULE', 'rules', ruleName, oldValue, newValue, performedBy);
  
  saveDatabase();
  return getRuleByName(ruleName);
}

function getRuleByName(ruleName) {
  const db = getDb();
  const result = db.exec('SELECT * FROM rules WHERE name = ?', [ruleName]);
  const rows = rowsToObjects(result);
  return rows.length > 0 ? rows[0] : null;
}

function canCreateClaim(itemStatus) {
  return [
    ITEM_STATUSES.IN_STORAGE,
    ITEM_STATUSES.CLAIM_PENDING
  ].includes(itemStatus);
}

function canApproveClaim(claimStatus, itemStatus) {
  return claimStatus === CLAIM_STATUSES.PENDING && 
         itemStatus === ITEM_STATUSES.CLAIM_PENDING;
}

function canTransferItem(itemStatus) {
  return [
    ITEM_STATUSES.REGISTERED,
    ITEM_STATUSES.IN_STORAGE,
    ITEM_STATUSES.IN_TRANSIT
  ].includes(itemStatus);
}

function shouldProcessOverdue(daysSinceFound) {
  const noticeDays = parseInt(getRuleValue('overdue_notice_days') || '15');
  const donationDays = parseInt(getRuleValue('overdue_donation_days') || '90');
  
  return {
    shouldSendNotice: daysSinceFound >= noticeDays && daysSinceFound < donationDays,
    shouldDonate: daysSinceFound >= donationDays
  };
}

function calculateDaysBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function addAuditLog(action, entityType, entityId, oldValue, newValue, performedBy) {
  const db = getDb();
  const id = uuidv4();
  
  db.run(
    'INSERT INTO audit_logs (id, action, entity_type, entity_id, old_value, new_value, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, action, entityType, entityId, JSON.stringify(oldValue), JSON.stringify(newValue), performedBy || 'system']
  );
  
  return id;
}

function rowsToObjects(result) {
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function getAuditLogs(entityType = null, entityId = null) {
  const db = getDb();
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  
  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }
  
  if (entityId) {
    query += ' AND entity_id = ?';
    params.push(entityId);
  }
  
  query += ' ORDER BY performed_at DESC';
  
  const result = db.exec(query, params);
  return rowsToObjects(result);
}

module.exports = {
  ITEM_STATUSES,
  CLAIM_STATUSES,
  getRuleValue,
  getAllRules,
  updateRule,
  getRuleByName,
  canCreateClaim,
  canApproveClaim,
  canTransferItem,
  shouldProcessOverdue,
  calculateDaysBetween,
  addAuditLog,
  rowsToObjects,
  getAuditLogs
};
