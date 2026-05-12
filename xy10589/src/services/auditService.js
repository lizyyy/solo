const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const STATUS = {
  OPEN: 'OPEN',
  PLAN_SUBMITTED: 'PLAN_SUBMITTED',
  PLAN_APPROVED: 'PLAN_APPROVED',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  OVERDUE: 'OVERDUE',
  ESCALATED: 'ESCALATED'
};

const RISK_LEVELS = ['高风险', '中风险', '低风险'];

function now() {
  return new Date().toISOString();
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function checkIdempotency(key) {
  return await getAsync('SELECT * FROM idempotency_log WHERE key = ?', [key]);
}

async function recordIdempotency(key, issueId, action, result) {
  await runAsync(
    'INSERT INTO idempotency_log (id, key, issue_id, action, result, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), key, issueId, action, result, now()]
  );
}

async function addStatusHistory(issueId, fromStatus, toStatus, action, actor, reason) {
  await runAsync(
    'INSERT INTO status_history (id, issue_id, from_status, to_status, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), issueId, fromStatus, toStatus, action, actor, reason, now()]
  );
}

async function createIssue(data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const id = uuidv4();
  const nowDate = now();
  const dueDate = data.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const issue = {
    id,
    audit_id: data.audit_id,
    issue_number: data.issue_number || `ISSUE-${Date.now()}`,
    title: data.title,
    description: data.description,
    risk_level: data.risk_level || '中风险',
    responsible_department: data.responsible_department,
    status: STATUS.OPEN,
    due_date: dueDate,
    original_due_date: dueDate,
    customer_approved: 0,
    created_by: data.created_by || 'system',
    created_at: nowDate,
    updated_at: nowDate,
    version: 1
  };

  await runAsync(
    `INSERT INTO audit_issues 
     (id, audit_id, issue_number, title, description, risk_level, responsible_department, 
      status, due_date, original_due_date, customer_approved, created_by, created_at, updated_at, version, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [issue.id, issue.audit_id, issue.issue_number, issue.title, issue.description, issue.risk_level, 
     issue.responsible_department, issue.status, issue.due_date, issue.original_due_date, 
     issue.customer_approved, issue.created_by, issue.created_at, issue.updated_at, issue.version, idempotencyKey]
  );

  await addStatusHistory(id, null, STATUS.OPEN, '创建问题', data.created_by || 'system', '审核发现问题');
  await recordIdempotency(idempotencyKey, id, 'CREATE_ISSUE', JSON.stringify(issue));

  return { success: true, idempotent: false, data: issue };
}

async function submitPlan(issueId, data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  if (issue.status !== STATUS.OPEN && issue.status !== STATUS.REJECTED) {
    return { success: false, error: `当前状态 [${issue.status}] 不允许提交整改计划`, currentStatus: issue.status };
  }

  if (issue.risk_level === '高风险' && !data.supervisor_approved) {
    return { success: false, error: '高风险问题需要主管确认' };
  }

  const planId = uuidv4();
  await runAsync(
    'INSERT INTO rectification_plans (id, issue_id, plan_content, responsible_person, target_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [planId, issueId, data.plan_content, data.responsible_person, data.target_date, now()]
  );

  let newStatus = STATUS.PLAN_SUBMITTED;
  if (issue.risk_level === '高风险') {
    newStatus = STATUS.PLAN_SUBMITTED;
  }

  await runAsync(
    'UPDATE audit_issues SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [newStatus, now(), issueId]
  );

  await addStatusHistory(issueId, issue.status, newStatus, '提交整改计划', data.submitted_by, '整改计划已提交');

  const result = { success: true, planId, newStatus };
  await recordIdempotency(idempotencyKey, issueId, 'SUBMIT_PLAN', JSON.stringify(result));

  return { success: true, idempotent: false, data: result };
}

async function approvePlan(issueId, data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  if (issue.status !== STATUS.PLAN_SUBMITTED) {
    return { success: false, error: `当前状态 [${issue.status}] 不允许审批整改计划`, currentStatus: issue.status };
  }

  await runAsync(
    'UPDATE audit_issues SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [STATUS.PLAN_APPROVED, now(), issueId]
  );

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), issueId, 'PLAN_APPROVAL', data.approved_by, 'APPROVED', data.comments, now()]
  );

  await addStatusHistory(issueId, issue.status, STATUS.PLAN_APPROVED, '审批通过', data.approved_by, data.comments);

  const result = { success: true, newStatus: STATUS.PLAN_APPROVED };
  await recordIdempotency(idempotencyKey, issueId, 'APPROVE_PLAN', JSON.stringify(result));

  return { success: true, idempotent: false, data: result };
}

async function submitEvidence(issueId, data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  if (issue.status !== STATUS.PLAN_APPROVED && issue.status !== STATUS.REJECTED) {
    return { success: false, error: `当前状态 [${issue.status}] 不允许提交证据`, currentStatus: issue.status };
  }

  const latestEvidence = await getAsync(
    'SELECT MAX(version) as max_version FROM evidences WHERE issue_id = ?',
    [issueId]
  );
  const version = (latestEvidence.max_version || 0) + 1;

  const evidenceId = uuidv4();
  await runAsync(
    'INSERT INTO evidences (id, issue_id, version, content, file_url, submitted_by, submitted_at, is_valid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [evidenceId, issueId, version, data.content, data.file_url, data.submitted_by, now(), 1]
  );

  await runAsync(
    'UPDATE audit_issues SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [STATUS.EVIDENCE_SUBMITTED, now(), issueId]
  );

  await addStatusHistory(issueId, issue.status, STATUS.EVIDENCE_SUBMITTED, `提交证据(版本${version})`, data.submitted_by, '证据已提交');

  const result = { success: true, evidenceId, version, newStatus: STATUS.EVIDENCE_SUBMITTED };
  await recordIdempotency(idempotencyKey, issueId, 'SUBMIT_EVIDENCE', JSON.stringify(result));

  return { success: true, idempotent: false, data: result };
}

async function customerReview(issueId, data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  if (issue.status !== STATUS.EVIDENCE_SUBMITTED) {
    return { success: false, error: `当前状态 [${issue.status}] 不允许客户复审`, currentStatus: issue.status };
  }

  const evidences = await allAsync(
    'SELECT * FROM evidences WHERE issue_id = ? AND is_valid = 1 ORDER BY version DESC LIMIT 1',
    [issueId]
  );

  if (evidences.length === 0) {
    return { success: false, error: '证据缺失，不能复审', code: 'EVIDENCE_MISSING' };
  }

  await runAsync(
    'INSERT INTO reviews (id, issue_id, review_type, reviewer, result, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), issueId, 'CUSTOMER_REVIEW', data.reviewer, data.result, data.comments, now()]
  );

  let newStatus;
  let action;

  if (data.result === 'APPROVED') {
    newStatus = STATUS.CLOSED;
    action = '客户审核通过';
    await runAsync(
      'UPDATE audit_issues SET status = ?, customer_approved = 1, updated_at = ?, version = version + 1 WHERE id = ?',
      [STATUS.CLOSED, now(), issueId]
    );
  } else if (data.result === 'REJECTED') {
    newStatus = STATUS.REJECTED;
    action = '客户退回';
    
    const newDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await runAsync(
      'UPDATE audit_issues SET status = ?, due_date = ?, updated_at = ?, version = version + 1 WHERE id = ?',
      [STATUS.REJECTED, newDueDate, now(), issueId]
    );
  } else {
    return { success: false, error: '无效的审核结果' };
  }

  await addStatusHistory(issueId, issue.status, newStatus, action, data.reviewer, data.comments);

  const result = { success: true, newStatus, customerApproved: data.result === 'APPROVED' };
  await recordIdempotency(idempotencyKey, issueId, 'CUSTOMER_REVIEW', JSON.stringify(result));

  return { success: true, idempotent: false, data: result };
}

async function requestExtension(issueId, data) {
  const idempotencyKey = data.idempotency_key || uuidv4();
  
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) {
    return { success: true, idempotent: true, data: JSON.parse(existing.result) };
  }

  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  if (issue.status === STATUS.CLOSED) {
    return { success: false, error: '已关闭的问题不能延期' };
  }

  await runAsync(
    'INSERT INTO correction_records (id, issue_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), issueId, 'due_date', issue.due_date, data.new_due_date, data.approved_by, `延期审批: ${data.reason}`, now()]
  );

  await runAsync(
    'UPDATE audit_issues SET due_date = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [data.new_due_date, now(), issueId]
  );

  await addStatusHistory(issueId, issue.status, issue.status, '延期审批', data.approved_by, data.reason);

  const result = { success: true, newDueDate: data.new_due_date };
  await recordIdempotency(idempotencyKey, issueId, 'EXTENSION', JSON.stringify(result));

  return { success: true, idempotent: false, data: result };
}

async function checkOverdue() {
  const nowDate = now();
  const overdueIssues = await allAsync(
    `SELECT * FROM audit_issues 
     WHERE status NOT IN ('CLOSED', 'ESCALATED', 'OVERDUE') 
     AND due_date < ?`,
    [nowDate]
  );

  const results = [];
  for (const issue of overdueIssues) {
    await runAsync(
      'UPDATE audit_issues SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
      [STATUS.OVERDUE, now(), issue.id]
    );
    await addStatusHistory(issue.id, issue.status, STATUS.OVERDUE, '逾期标记', 'system', '超过整改期限');
    results.push({ issueId: issue.id, newStatus: STATUS.OVERDUE });
  }

  const escalatedIssues = await allAsync(
    `SELECT * FROM audit_issues 
     WHERE status = 'OVERDUE' 
     AND julianday(?) - julianday(due_date) > 3`,
    [nowDate]
  );

  for (const issue of escalatedIssues) {
    await runAsync(
      'UPDATE audit_issues SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
      [STATUS.ESCALATED, now(), issue.id]
    );
    await addStatusHistory(issue.id, issue.status, STATUS.ESCALATED, '逾期升级', 'system', '逾期超过3天，已升级');
    results.push({ issueId: issue.id, newStatus: STATUS.ESCALATED, escalated: true });
  }

  return { success: true, processed: results.length, details: results };
}

async function getIssueDetail(issueId) {
  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  const plans = await allAsync('SELECT * FROM rectification_plans WHERE issue_id = ? ORDER BY created_at', [issueId]);
  const evidences = await allAsync('SELECT * FROM evidences WHERE issue_id = ? ORDER BY version DESC', [issueId]);
  const reviews = await allAsync('SELECT * FROM reviews WHERE issue_id = ? ORDER BY reviewed_at DESC', [issueId]);
  const history = await allAsync('SELECT * FROM status_history WHERE issue_id = ? ORDER BY created_at', [issueId]);
  const corrections = await allAsync('SELECT * FROM correction_records WHERE issue_id = ? ORDER BY corrected_at DESC', [issueId]);

  return {
    success: true,
    data: {
      issue,
      plans,
      evidences,
      reviews,
      history,
      corrections,
      currentStatus: issue.status,
      isApproved: issue.customer_approved === 1
    }
  };
}

async function listIssues(filters = {}) {
  let sql = 'SELECT * FROM audit_issues WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.department) {
    sql += ' AND responsible_department = ?';
    params.push(filters.department);
  }
  if (filters.risk_level) {
    sql += ' AND risk_level = ?';
    params.push(filters.risk_level);
  }

  sql += ' ORDER BY created_at DESC';

  const issues = await allAsync(sql, params);
  return { success: true, data: issues, count: issues.length };
}

async function generateReport(filters = {}) {
  const issuesResult = await listIssues(filters);
  const issues = issuesResult.data;

  const departments = [...new Set(issues.map(i => i.responsible_department))];
  const statuses = [...new Set(issues.map(i => i.status))];

  const byDepartment = {};
  const byStatus = {};
  const byRisk = {};

  for (const dept of departments) {
    byDepartment[dept] = issues.filter(i => i.responsible_department === dept).length;
  }

  for (const status of statuses) {
    byStatus[status] = issues.filter(i => i.status === status).length;
  }

  for (const risk of RISK_LEVELS) {
    byRisk[risk] = issues.filter(i => i.risk_level === risk).length;
  }

  const closedCount = issues.filter(i => i.status === STATUS.CLOSED).length;
  const overdueCount = issues.filter(i => i.status === STATUS.OVERDUE || i.status === STATUS.ESCALATED).length;
  const approvedCount = issues.filter(i => i.customer_approved === 1).length;

  return {
    success: true,
    data: {
      generatedAt: now(),
      totalIssues: issues.length,
      closed: closedCount,
      overdue: overdueCount,
      customerApproved: approvedCount,
      pendingReview: issues.filter(i => i.status === STATUS.EVIDENCE_SUBMITTED).length,
      byDepartment,
      byStatus,
      byRisk,
      issues
    }
  };
}

async function manualCorrection(issueId, data) {
  const issue = await getAsync('SELECT * FROM audit_issues WHERE id = ?', [issueId]);
  if (!issue) {
    return { success: false, error: '问题不存在' };
  }

  const oldValue = issue[data.field];
  if (oldValue === undefined) {
    return { success: false, error: '无效的字段名' };
  }

  await runAsync(
    'INSERT INTO correction_records (id, issue_id, field_name, old_value, new_value, corrected_by, reason, corrected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), issueId, data.field, String(oldValue), String(data.new_value), data.corrected_by, data.reason, now()]
  );

  const updateSql = `UPDATE audit_issues SET ${data.field} = ?, updated_at = ?, version = version + 1 WHERE id = ?`;
  await runAsync(updateSql, [data.new_value, now(), issueId]);

  await addStatusHistory(
    issueId, 
    issue.status, 
    issue.status, 
    `人工修正: ${data.field}`, 
    data.corrected_by, 
    `从 "${oldValue}" 修改为 "${data.new_value}"，原因: ${data.reason}`
  );

  return {
    success: true,
    data: {
      field: data.field,
      oldValue,
      newValue: data.new_value,
      reason: data.reason,
      correctedBy: data.corrected_by
    }
  };
}

module.exports = {
  STATUS,
  RISK_LEVELS,
  createIssue,
  submitPlan,
  approvePlan,
  submitEvidence,
  customerReview,
  requestExtension,
  checkOverdue,
  getIssueDetail,
  listIssues,
  generateReport,
  manualCorrection
};
