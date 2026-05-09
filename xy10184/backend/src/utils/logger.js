const db = require('../database');

const logActions = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE_APPEAL: 'CREATE_APPEAL',
  UPDATE_APPEAL: 'UPDATE_APPEAL',
  ASSIGN_OPERATOR: 'ASSIGN_OPERATOR',
  PROCESS_APPEAL: 'PROCESS_APPEAL',
  SUBMIT_TO_REVIEW: 'SUBMIT_TO_REVIEW',
  REVIEW_APPROVE: 'REVIEW_APPROVE',
  REVIEW_REJECT: 'REVIEW_REJECT',
  UPLOAD_ATTACHMENT: 'UPLOAD_ATTACHMENT',
  DELETE_ATTACHMENT: 'DELETE_ATTACHMENT',
  EXPORT_DATA: 'EXPORT_DATA',
  VIEW_DETAIL: 'VIEW_DETAIL'
};

const logModules = {
  AUTH: 'AUTH',
  APPEAL: 'APPEAL',
  ATTACHMENT: 'ATTACHMENT',
  EXPORT: 'EXPORT',
  SYSTEM: 'SYSTEM'
};

function createLog(req, action, module, detail = '', targetId = null) {
  const userId = req.user?.id || null;
  const userName = req.user?.name || '';
  const ip = req.ip || req.connection?.remoteAddress || '';
  
  try {
    const stmt = db.prepare(`
      INSERT INTO operation_logs (user_id, user_name, action, module, target_id, detail, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(userId, userName, action, module, targetId, detail, ip);
  } catch (err) {
    console.error('日志记录失败:', err);
  }
}

function getLogs(filters = {}, page = 1, pageSize = 20) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (filters.userId) {
    whereClause += ' AND user_id = ?';
    params.push(filters.userId);
  }
  
  if (filters.action) {
    whereClause += ' AND action = ?';
    params.push(filters.action);
  }
  
  if (filters.module) {
    whereClause += ' AND module = ?';
    params.push(filters.module);
  }
  
  if (filters.startTime) {
    whereClause += ' AND created_at >= ?';
    params.push(filters.startTime);
  }
  
  if (filters.endTime) {
    whereClause += ' AND created_at <= ?';
    params.push(filters.endTime);
  }
  
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM operation_logs ${whereClause}`);
  const { total } = countStmt.get(...params);
  
  const offset = (page - 1) * pageSize;
  const listStmt = db.prepare(`
    SELECT * FROM operation_logs 
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  const list = listStmt.all(...params, pageSize, offset);
  
  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

module.exports = {
  logActions,
  logModules,
  createLog,
  getLogs
};
