const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

const AUDIT_ACTIONS = {
  TASK_CREATE: 'task_create',
  TASK_UPDATE: 'task_update',
  TASK_DELETE: 'task_delete',
  TASK_STATUS_CHANGE: 'task_status_change',
  TASK_ASSIGN: 'task_assign',
  TASK_RETRY: 'task_retry',
  TASK_COMPLETE: 'task_complete',
  LOGIN: 'login',
  EXPORT_REPORT: 'export_report'
};

const MODULES = {
  TASK: 'task',
  USER: 'user',
  SYSTEM: 'system',
  REPORT: 'report'
};

async function logAudit({
  action,
  module,
  targetId = null,
  operator = 'system',
  ip = null,
  userAgent = null,
  requestBody = null,
  responseBody = null
}) {
  try {
    const id = uuidv4();
    const now = Date.now();
    
    await db.run(
      `INSERT INTO audit_logs 
       (id, action, module, target_id, operator, ip, user_agent, request_body, response_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        action,
        module,
        targetId,
        operator,
        ip,
        userAgent,
        requestBody ? JSON.stringify(requestBody) : null,
        responseBody ? JSON.stringify(responseBody) : null,
        now
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || null;
}

function decodeOperator(encoded) {
  if (!encoded) return 'system';
  try {
    return decodeURIComponent(encoded);
  } catch (e) {
    return encoded;
  }
}

function auditMiddleware(action, module, options = {}) {
  return (req, res, next) => {
    const operator = decodeOperator(req.headers['x-operator']);
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    let requestBody = null;
    
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        const safeBody = { ...req.body };
        if (safeBody.password) delete safeBody.password;
        requestBody = safeBody;
      }
    } catch (e) {}
    
    const targetId = req.params.id || (req.body && req.body.id) || null;
    
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      logAudit({
        action,
        module,
        targetId,
        operator,
        ip,
        userAgent,
        requestBody,
        responseBody: options.includeResponse !== false ? body : null
      });
      return originalJson(body);
    };
    
    next();
  };
}

async function getAuditLogs(filter = {}, page = 1, pageSize = 20) {
  const conditions = [];
  const params = [];
  
  if (filter.action) {
    conditions.push('action = ?');
    params.push(filter.action);
  }
  if (filter.module) {
    conditions.push('module = ?');
    params.push(filter.module);
  }
  if (filter.targetId) {
    conditions.push('target_id = ?');
    params.push(filter.targetId);
  }
  if (filter.operator) {
    conditions.push('operator = ?');
    params.push(filter.operator);
  }
  if (filter.startTime) {
    conditions.push('created_at >= ?');
    params.push(filter.startTime);
  }
  if (filter.endTime) {
    conditions.push('created_at <= ?');
    params.push(filter.endTime);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC`;
  
  return db.allPaged(sql, params, page, pageSize);
}

async function getTaskAuditLogs(taskId) {
  return db.all(
    `SELECT * FROM audit_logs 
     WHERE target_id = ? AND module = ? 
     ORDER BY created_at DESC`,
    [taskId, MODULES.TASK]
  );
}

module.exports = {
  AUDIT_ACTIONS,
  MODULES,
  logAudit,
  auditMiddleware,
  getAuditLogs,
  getTaskAuditLogs
};
