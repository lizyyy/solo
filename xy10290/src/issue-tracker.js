const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const ISSUE_TYPES = {
  INVALID_READING: 'INVALID_READING',
  ALLOCATION_DISCREPANCY: 'ALLOCATION_DISCREPANCY',
  DEPOSIT_SHORTAGE: 'DEPOSIT_SHORTAGE',
  DATA_CORRUPTION: 'DATA_CORRUPTION',
  RULE_VIOLATION: 'RULE_VIOLATION',
  RETRY_FAILED: 'RETRY_FAILED'
};

const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED'
};

function createIssue(issueType, sourceType, sourceRef, sourceJson, description, severity = 'MEDIUM') {
  const issueId = uuidv4();
  const now = Date.now();
  
  const sourceJsonStr = typeof sourceJson === 'string' 
    ? sourceJson 
    : JSON.stringify(sourceJson);
  
  db.prepare(`
    INSERT INTO issue_records 
      (id, issue_type, source_type, source_ref, source_json, severity, status, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    issueId, 
    issueType, 
    sourceType, 
    sourceRef, 
    sourceJsonStr, 
    severity, 
    STATUS.OPEN, 
    description, 
    now
  );
  
  return {
    id: issueId,
    issue_type: issueType,
    source_type: sourceType,
    source_ref: sourceRef,
    severity,
    status: STATUS.OPEN,
    description
  };
}

function createIssueFromError(error, sourceType, sourceRef, sourceJson) {
  let severity = SEVERITY.MEDIUM;
  let issueType = ISSUE_TYPES.DATA_CORRUPTION;
  
  if (error.ruleId) {
    issueType = ISSUE_TYPES.RULE_VIOLATION;
    severity = SEVERITY.HIGH;
  }
  
  return createIssue(
    issueType,
    sourceType,
    sourceRef,
    sourceJson,
    error.message,
    severity
  );
}

function resolveIssue(issueId, resolutionNote) {
  const now = Date.now();
  
  const result = db.prepare(`
    UPDATE issue_records 
    SET status = ?, resolved_at = ?, resolution_note = ?
    WHERE id = ?
  `).run(STATUS.RESOLVED, now, resolutionNote, issueId);
  
  return result.changes > 0;
}

function getIssues(filters = {}) {
  let sql = 'SELECT * FROM issue_records WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.severity) {
    sql += ' AND severity = ?';
    params.push(filters.severity);
  }
  if (filters.issue_type) {
    sql += ' AND issue_type = ?';
    params.push(filters.issue_type);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return db.prepare(sql).all(...params);
}

function getIssueCount(filters = {}) {
  let sql = 'SELECT COUNT(*) as count FROM issue_records WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.severity) {
    sql += ' AND severity = ?';
    params.push(filters.severity);
  }
  
  const result = db.prepare(sql).get(...params);
  return result.count;
}

module.exports = {
  ISSUE_TYPES,
  SEVERITY,
  STATUS,
  createIssue,
  createIssueFromError,
  resolveIssue,
  getIssues,
  getIssueCount
};
