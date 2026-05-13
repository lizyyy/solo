const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware, requireRoles } = require('../middleware/auth');
const { createLog, logActions, logModules } = require('../utils/logger');

const router = express.Router();

const STATUS_MAP = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
};

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已通过',
  rejected: '已驳回'
};

function generateAppealNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AP${year}${month}${day}${random}`;
}

function addHistory(appealId, fromStatus, toStatus, action, remark, userId, userName) {
  const stmt = db.prepare(`
    INSERT INTO appeal_history (appeal_id, from_status, to_status, action, remark, operator_id, operator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(appealId, fromStatus, toStatus, action, remark, userId, userName);
}

router.get('/', authMiddleware, (req, res) => {
  const { 
    status, 
    content_type, 
    keyword, 
    start_time, 
    end_time,
    operator_id,
    page = 1, 
    pageSize = 20 
  } = req.query;
  
  const user = req.user;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    whereClause += ' AND a.status = ?';
    params.push(status);
  }
  
  if (content_type) {
    whereClause += ' AND a.content_type = ?';
    params.push(content_type);
  }
  
  if (keyword) {
    whereClause += ' AND (a.title LIKE ? OR a.appeal_no LIKE ? OR a.content LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }
  
  if (start_time) {
    whereClause += ' AND a.created_at >= ?';
    params.push(start_time);
  }
  
  if (end_time) {
    whereClause += ' AND a.created_at <= ?';
    params.push(end_time);
  }
  
  if (operator_id) {
    if (operator_id === 'self') {
      whereClause += ' AND a.operator_id = ?';
      params.push(user.id);
    } else {
      whereClause += ' AND a.operator_id = ?';
      params.push(operator_id);
    }
  }
  
  if (user.role === 'operator') {
    whereClause += ' AND (a.operator_id = ? OR a.status = ?)';
    params.push(user.id, 'pending');
  } else if (user.role === 'reviewer') {
    whereClause += ' AND a.status IN (?, ?, ?, ?)';
    params.push('reviewing', 'completed', 'rejected', 'processing');
  }
  
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM appeals a ${whereClause}`);
  const { total } = countStmt.get(...params);
  
  const offset = (page - 1) * pageSize;
  const listStmt = db.prepare(`
    SELECT 
      a.*,
      op.name as operator_name,
      rv.name as reviewer_name
    FROM appeals a
    LEFT JOIN users op ON a.operator_id = op.id
    LEFT JOIN users rv ON a.reviewer_id = rv.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const list = listStmt.all(...params, Number(pageSize), offset);
  
  res.json({
    list,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / pageSize)
  });
});

router.get('/stats', authMiddleware, (req, res) => {
  const user = req.user;
  
  let baseWhere = '';
  const params = [];
  
  if (user.role === 'operator') {
    baseWhere = 'WHERE operator_id = ?';
    params.push(user.id);
  } else if (user.role === 'reviewer') {
    baseWhere = 'WHERE status IN (?, ?, ?, ?)';
    params.push('reviewing', 'completed', 'rejected', 'processing');
  }
  
  const stats = {
    pending: 0,
    processing: 0,
    reviewing: 0,
    completed: 0,
    rejected: 0,
    total: 0
  };
  
  if (baseWhere) {
    Object.keys(stats).forEach(status => {
      if (status !== 'total') {
        const row = db.prepare(`
          SELECT COUNT(*) as count FROM appeals 
          ${baseWhere} AND status = ?
        `).get(...params, status);
        stats[status] = row.count;
      }
    });
    stats.total = db.prepare(`SELECT COUNT(*) as count FROM appeals ${baseWhere}`).get(...params).count;
  } else {
    const all = db.prepare('SELECT status, COUNT(*) as count FROM appeals GROUP BY status').all();
    all.forEach(row => {
      if (stats[row.status] !== undefined) {
        stats[row.status] = row.count;
      }
    });
    stats.total = db.prepare('SELECT COUNT(*) as count FROM appeals').get().count;
  }
  
  res.json(stats);
});

router.get('/constants', (req, res) => {
  res.json({
    status_map: STATUS_NAMES,
    content_types: [
      { value: 'text', label: '文本' },
      { value: 'image', label: '图片' },
      { value: 'video', label: '视频' },
      { value: 'audio', label: '音频' },
      { value: 'link', label: '链接' },
      { value: 'other', label: '其他' }
    ],
    results: [
      { value: 'pass', label: '建议通过' },
      { value: 'reject', label: '建议驳回' }
    ]
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const appeal = db.prepare(`
    SELECT 
      a.*,
      op.name as operator_name,
      rv.name as reviewer_name
    FROM appeals a
    LEFT JOIN users op ON a.operator_id = op.id
    LEFT JOIN users rv ON a.reviewer_id = rv.id
    WHERE a.id = ?
  `).get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  const user = req.user;
  if (user.role === 'operator' && appeal.operator_id !== user.id && appeal.status === 'pending') {
    return res.status(403).json({ error: '无权限查看该申诉' });
  }
  
  const history = db.prepare(`
    SELECT * FROM appeal_history 
    WHERE appeal_id = ?
    ORDER BY created_at ASC
  `).all(id);
  
  const attachments = db.prepare(`
    SELECT * FROM attachments 
    WHERE appeal_id = ?
    ORDER BY created_at DESC
  `).all(id);
  
  createLog(req, logActions.VIEW_DETAIL, logModules.APPEAL, `查看申诉详情: ${appeal.appeal_no}`, appeal.id);
  
  res.json({
    appeal,
    history,
    attachments
  });
});

router.post('/', authMiddleware, (req, res) => {
  const { title, content, content_type, source_platform, source_id } = req.body;
  
  if (!title || !content || !content_type) {
    return res.status(400).json({ error: '标题、内容和类型不能为空' });
  }
  
  const appealNo = generateAppealNo();
  
  const stmt = db.prepare(`
    INSERT INTO appeals (appeal_no, title, content, content_type, source_platform, source_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(appealNo, title, content, content_type, source_platform, source_id, 'pending');
  
  addHistory(
    result.lastInsertRowid,
    null,
    'pending',
    '创建申诉',
    `标题: ${title}`,
    req.user.id,
    req.user.name
  );
  
  createLog(req, logActions.CREATE_APPEAL, logModules.APPEAL, `创建申诉: ${appealNo}`, result.lastInsertRowid);
  
  res.json({
    id: result.lastInsertRowid,
    appeal_no: appealNo
  });
});

router.post('/:id/assign', authMiddleware, requireRoles('admin'), (req, res) => {
  const { id } = req.params;
  const { operator_id } = req.body;
  
  if (!operator_id) {
    return res.status(400).json({ error: '必须指定操作员' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (appeal.status !== 'pending') {
    return res.status(400).json({ error: '只有待处理状态的申诉才能分配' });
  }
  
  const operator = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(operator_id, 'operator');
  
  if (!operator) {
    return res.status(400).json({ error: '操作员不存在或角色无效' });
  }
  
  db.prepare(`
    UPDATE appeals 
    SET operator_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(operator_id, 'processing', id);
  
  addHistory(
    id,
    'pending',
    'processing',
    '分配操作员',
    `分配给: ${operator.name}`,
    req.user.id,
    req.user.name
  );
  
  createLog(req, logActions.ASSIGN_OPERATOR, logModules.APPEAL, `申诉 ${appeal.appeal_no} 分配给 ${operator.name}`, id);
  
  res.json({ success: true });
});

router.post('/:id/pickup', authMiddleware, requireRoles('operator'), (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (appeal.status !== 'pending') {
    return res.status(400).json({ error: '只有待处理状态的申诉才能领取' });
  }
  
  if (appeal.operator_id) {
    return res.status(400).json({ error: '该申诉已被其他操作员领取' });
  }
  
  db.prepare(`
    UPDATE appeals 
    SET operator_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(user.id, 'processing', id);
  
  addHistory(
    id,
    'pending',
    'processing',
    '领取申诉',
    '操作员领取该申诉',
    user.id,
    user.name
  );
  
  createLog(req, logActions.ASSIGN_OPERATOR, logModules.APPEAL, `操作员 ${user.name} 领取申诉 ${appeal.appeal_no}`, id);
  
  res.json({ success: true });
});

router.post('/:id/submit-review', authMiddleware, requireRoles('operator', 'admin'), (req, res) => {
  const { id } = req.params;
  const { result, result_reason } = req.body;
  const user = req.user;
  
  if (!result) {
    return res.status(400).json({ error: '必须提交处理结果' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (appeal.status !== 'processing') {
    return res.status(400).json({ error: '只有处理中的申诉才能提交复核' });
  }
  
  if (user.role === 'operator' && appeal.operator_id !== user.id) {
    return res.status(403).json({ error: '无权限操作该申诉' });
  }
  
  db.prepare(`
    UPDATE appeals 
    SET status = ?, result = ?, result_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run('reviewing', result, result_reason, id);
  
  addHistory(
    id,
    'processing',
    'reviewing',
    '提交复核',
    `处理结果: ${result === 'pass' ? '建议通过' : '建议驳回'}, 结果说明: ${result_reason || '无'}`,
    user.id,
    user.name
  );
  
  createLog(req, logActions.SUBMIT_TO_REVIEW, logModules.APPEAL, `申诉 ${appeal.appeal_no} 提交复核`, id);
  
  res.json({ success: true });
});

router.post('/:id/review', authMiddleware, requireRoles('reviewer', 'admin'), (req, res) => {
  const { id } = req.params;
  const { action, remark } = req.body;
  const user = req.user;
  
  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '操作类型无效' });
  }
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (appeal.status !== 'reviewing') {
    return res.status(400).json({ error: '只有待复核状态的申诉才能复核' });
  }
  
  const newStatus = action === 'approve' ? 'completed' : 'rejected';
  const actionName = action === 'approve' ? '复核通过' : '复核驳回';
  
  db.prepare(`
    UPDATE appeals 
    SET status = ?, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, user.id, id);
  
  addHistory(
    id,
    'reviewing',
    newStatus,
    actionName,
    remark || '无',
    user.id,
    user.name
  );
  
  createLog(req, action === 'approve' ? logActions.REVIEW_APPROVE : logActions.REVIEW_REJECT, logModules.APPEAL, `申诉 ${appeal.appeal_no} ${actionName}`, id);
  
  res.json({ success: true });
});

router.put('/:id', authMiddleware, requireRoles('operator', 'admin'), (req, res) => {
  const { id } = req.params;
  const { title, content, content_type, source_platform, source_id } = req.body;
  const user = req.user;
  
  const appeal = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  
  if (!appeal) {
    return res.status(404).json({ error: '申诉不存在' });
  }
  
  if (user.role === 'operator' && appeal.operator_id !== user.id) {
    return res.status(403).json({ error: '无权限修改该申诉' });
  }
  
  if (['completed', 'rejected'].includes(appeal.status)) {
    return res.status(400).json({ error: '已完结的申诉不能修改' });
  }
  
  const updates = [];
  const params = [];
  
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (content_type !== undefined) { updates.push('content_type = ?'); params.push(content_type); }
  if (source_platform !== undefined) { updates.push('source_platform = ?'); params.push(source_platform); }
  if (source_id !== undefined) { updates.push('source_id = ?'); params.push(source_id); }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  db.prepare(`UPDATE appeals SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  createLog(req, logActions.UPDATE_APPEAL, logModules.APPEAL, `更新申诉 ${appeal.appeal_no}`, id);
  
  res.json({ success: true });
});

module.exports = router;
