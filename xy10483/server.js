const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = 3000;

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = auth.generateToken(user);
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      max_secret_level: user.max_secret_level
    }
  });
});

app.post('/api/users', auth.authenticateToken, auth.requireRole('admin'), (req, res) => {
  const { username, password, role, max_secret_level } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ error: '请提供用户名、密码和角色' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);
  const level = max_secret_level !== undefined ? max_secret_level : 0;

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, max_secret_level)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username, password_hash, role, level);

  res.status(201).json({ id, username, role, max_secret_level: level });
});

app.post('/api/documents', auth.authenticateToken, auth.requireRole('admin'), (req, res) => {
  const { title, type, secret_level, description } = req.body;

  if (!title || !type || secret_level === undefined) {
    return res.status(400).json({ error: '请提供标题、类型和密级' });
  }

  if (!['contract', 'bid', 'technical'].includes(type)) {
    return res.status(400).json({ error: '类型必须是 contract, bid, technical 之一' });
  }

  if (secret_level < 0 || secret_level > 3) {
    return res.status(400).json({ error: '密级必须在 0-3 之间' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO documents (id, title, type, secret_level, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title, type, secret_level, description || null);

  res.status(201).json({
    id, title, type, secret_level, description: description || null,
    is_destroyed: false
  });
});

app.get('/api/documents', auth.authenticateToken, (req, res) => {
  const docs = db.prepare(`
    SELECT id, title, type, secret_level, description, is_destroyed, created_at
    FROM documents
    WHERE is_destroyed = 0
  `).all();
  res.json(docs);
});

app.get('/api/documents/:id', auth.authenticateToken, (req, res) => {
  const doc = db.prepare(`
    SELECT * FROM documents WHERE id = ?
  `).get(req.params.id);

  if (!doc) {
    return res.status(404).json({ error: '资料不存在' });
  }

  if (req.user.max_secret_level < doc.secret_level) {
    return res.status(403).json({ 
      error: '权限不足，无法查看该密级资料',
      user_level: req.user.max_secret_level,
      required_level: doc.secret_level
    });
  }

  res.json(doc);
});

app.post('/api/borrow', auth.authenticateToken, auth.checkNoOverdue, (req, res) => {
  const { document_id, borrow_days } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: '请提供资料ID' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
  if (!doc) {
    return res.status(404).json({ error: '资料不存在' });
  }

  if (doc.is_destroyed) {
    return res.status(403).json({ error: '该资料已销毁，无法借阅' });
  }

  if (req.user.max_secret_level < doc.secret_level) {
    return res.status(403).json({ 
      error: '权限不足，无法借阅该密级资料',
      user_level: req.user.max_secret_level,
      required_level: doc.secret_level
    });
  }

  const activeBorrow = db.prepare(`
    SELECT id FROM borrow_records 
    WHERE document_id = ? AND status IN ('pending', 'approved', 'borrowed', 'overdue')
    LIMIT 1
  `).get(document_id);

  if (activeBorrow) {
    return res.status(400).json({ error: '该资料已被借出或有正在处理的借阅申请' });
  }

  const needApproval = doc.secret_level >= 2;
  const borrowId = uuidv4();
  const days = borrow_days || 7;
  const maxRenew = doc.secret_level >= 2 ? 1 : 2;

  const now = new Date();
  const dueTime = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  if (needApproval) {
    db.prepare(`
      INSERT INTO borrow_records (
        id, document_id, user_id, status, max_renew_count
      ) VALUES (?, ?, ?, 'pending', ?)
    `).run(borrowId, document_id, req.user.id, maxRenew);

    res.status(201).json({
      id: borrowId,
      status: 'pending',
      message: '已提交高密级资料借阅申请，请等待审批',
      document: { id: doc.id, title: doc.title, secret_level: doc.secret_level }
    });
  } else {
    db.prepare(`
      INSERT INTO borrow_records (
        id, document_id, user_id, status, approved_by, approved_time, due_time, borrow_time, max_renew_count
      ) VALUES (?, ?, ?, 'borrowed', ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `).run(borrowId, document_id, req.user.id, req.user.id, dueTime.toISOString(), now.toISOString(), maxRenew);

    res.status(201).json({
      id: borrowId,
      status: 'borrowed',
      due_time: dueTime.toISOString(),
      message: '借阅成功'
    });
  }
});

app.get('/api/borrow/pending', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const records = db.prepare(`
    SELECT br.*, d.title, d.secret_level, d.type, u.username as applicant_username
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    WHERE br.status = 'pending'
    AND d.secret_level <= ?
  `).all(req.user.max_secret_level);
  res.json(records);
});

app.post('/api/borrow/:id/approve', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const borrow_id = req.params.id;
  const { borrow_days } = req.body;

  const record = db.prepare(`
    SELECT br.*, d.secret_level
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    WHERE br.id = ?
  `).get(borrow_id);

  if (!record) {
    return res.status(404).json({ error: '借阅记录不存在' });
  }

  if (record.status !== 'pending') {
    return res.status(400).json({ error: '该申请状态不是待审批状态' });
  }

  if (req.user.max_secret_level < record.secret_level) {
    return res.status(403).json({ error: '审批人权限不足，无法审批该密级资料' });
  }

  const days = borrow_days || 7;
  const now = new Date();
  const dueTime = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  db.prepare(`
    UPDATE borrow_records 
    SET status = 'approved', approved_by = ?, approved_time = CURRENT_TIMESTAMP, due_time = ?, borrow_time = ?
    WHERE id = ?
  `).run(req.user.id, dueTime.toISOString(), now.toISOString(), borrow_id);

  res.json({
    id: borrow_id,
    status: 'approved',
    approved_by: req.user.id,
    due_time: dueTime.toISOString(),
    message: '审批通过，资料已借出'
  });
});

app.post('/api/borrow/:id/reject', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const { reason } = req.body;
  const borrow_id = req.params.id;

  const record = db.prepare(`
    SELECT br.*, d.secret_level
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    WHERE br.id = ?
  `).get(borrow_id);

  if (!record) {
    return res.status(404).json({ error: '借阅记录不存在' });
  }

  if (record.status !== 'pending') {
    return res.status(400).json({ error: '该申请状态不是待审批状态' });
  }

  if (req.user.max_secret_level < record.secret_level) {
    return res.status(403).json({ error: '审批人权限不足，无法审批该密级资料' });
  }

  db.prepare(`
    UPDATE borrow_records 
    SET status = 'rejected', approved_by = ?, approved_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, borrow_id);

  res.json({
    id: borrow_id,
    status: 'rejected',
    rejected_by: req.user.id,
    reject_reason: reason || '未说明原因',
    message: '已拒绝申请'
  });
});

app.post('/api/borrow/:id/return', auth.authenticateToken, (req, res) => {
  const borrow_id = req.params.id;

  const record = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(borrow_id);
  if (!record) {
    return res.status(404).json({ error: '借阅记录不存在' });
  }

  if (record.user_id !== req.user.id && req.user.role === 'user') {
    return res.status(403).json({ error: '无权归还他人的借阅记录' });
  }

  if (record.status === 'returned') {
    return res.json({
      id: borrow_id,
      status: 'returned',
      message: '资料已归还（幂等：该记录已处于归还状态）'
    });
  }

  if (!['borrowed', 'overdue', 'approved'].includes(record.status)) {
    return res.status(400).json({ error: '该记录不处于可归还状态' });
  }

  db.prepare(`
    UPDATE borrow_records 
    SET status = 'returned', return_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(borrow_id);

  res.json({
    id: borrow_id,
    status: 'returned',
    return_time: new Date().toISOString(),
    message: '归还成功'
  });
});

app.post('/api/borrow/:id/renew', auth.authenticateToken, auth.checkNoOverdue, (req, res) => {
  const borrow_id = req.params.id;
  const { renew_days } = req.body;

  const record = db.prepare(`
    SELECT br.*, d.secret_level, d.is_destroyed
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    WHERE br.id = ?
  `).get(borrow_id);

  if (!record) {
    return res.status(404).json({ error: '借阅记录不存在' });
  }

  if (record.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权续借他人的借阅记录' });
  }

  if (record.status !== 'borrowed') {
    return res.status(400).json({ error: '只有已借出状态才能续借' });
  }

  if (record.renew_count >= record.max_renew_count) {
    return res.status(400).json({
      error: '已达到最大续借次数',
      current: record.renew_count,
      max: record.max_renew_count
    });
  }

  const needApproval = record.secret_level >= 2;
  const renewId = uuidv4();

  if (needApproval) {
    db.prepare(`
      INSERT INTO renew_requests (id, borrow_record_id, user_id, status)
      VALUES (?, ?, ?, 'pending')
    `).run(renewId, borrow_id, req.user.id);

    res.status(201).json({
      renew_id: renewId,
      status: 'pending',
      message: '高密级资料续借申请已提交，请等待审批'
    });
  } else {
    const days = renew_days || 7;
    const currentDue = new Date(record.due_time);
    const newDue = new Date(currentDue.getTime() + days * 24 * 60 * 60 * 1000);

    db.prepare(`
      UPDATE borrow_records 
      SET renew_count = renew_count + 1,
          due_time = ?
      WHERE id = ?
    `).run(newDue.toISOString(), borrow_id);

    db.prepare(`
      INSERT INTO renew_requests (id, borrow_record_id, user_id, status, approved_by, approved_time, due_time_after_renew)
      VALUES (?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP, ?)
    `).run(renewId, borrow_id, req.user.id, req.user.id, newDue.toISOString());

    res.json({
      renew_id: renewId,
      status: 'approved',
      new_due_time: newDue.toISOString(),
      renew_count: record.renew_count + 1,
      message: '续借成功'
    });
  }
});

app.get('/api/renew/pending', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const requests = db.prepare(`
    SELECT rr.*, br.document_id, br.user_id as borrower_id, d.title, d.secret_level, u.username as applicant_username
    FROM renew_requests rr
    JOIN borrow_records br ON rr.borrow_record_id = br.id
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    WHERE rr.status = 'pending'
    AND d.secret_level <= ?
  `).all(req.user.max_secret_level);
  res.json(requests);
});

app.post('/api/renew/:id/approve', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const renewId = req.params.id;
  const { renew_days } = req.body;

  const request = db.prepare(`
    SELECT rr.*, br.document_id, br.due_time, br.renew_count, br.max_renew_count, d.secret_level
    FROM renew_requests rr
    JOIN borrow_records br ON rr.borrow_record_id = br.id
    JOIN documents d ON br.document_id = d.id
    WHERE rr.id = ?
  `).get(renewId);

  if (!request) {
    return res.status(404).json({ error: '续借请求不存在' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ error: '该续借请求不处于待审批状态' });
  }

  if (req.user.max_secret_level < request.secret_level) {
    return res.status(403).json({ error: '审批人权限不足' });
  }

  if (request.renew_count >= request.max_renew_count) {
    return res.status(400).json({
      error: '已达到最大续借次数'
    });
  }

  const days = renew_days || 7;
  const currentDue = new Date(request.due_time);
  const newDue = new Date(currentDue.getTime() + days * 24 * 60 * 60 * 1000);

  db.prepare(`
    UPDATE borrow_records 
    SET renew_count = renew_count + 1,
        due_time = ?
    WHERE id = ?
  `).run(newDue.toISOString(), request.borrow_record_id);

  db.prepare(`
    UPDATE renew_requests 
    SET status = 'approved', approved_by = ?, approved_time = CURRENT_TIMESTAMP, due_time_after_renew = ?
    WHERE id = ?
  `).run(req.user.id, newDue.toISOString(), renewId);

  res.json({
    renew_id: renewId,
    status: 'approved',
    approved_by: req.user.id,
    new_due_time: newDue.toISOString(),
    message: '续借审批通过'
  });
});

app.post('/api/renew/:id/reject', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const renewId = req.params.id;

  const request = db.prepare(`
    SELECT rr.*, d.secret_level
    FROM renew_requests rr
    JOIN borrow_records br ON rr.borrow_record_id = br.id
    JOIN documents d ON br.document_id = d.id
    WHERE rr.id = ?
  `).get(renewId);

  if (!request) {
    return res.status(404).json({ error: '续借请求不存在' });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({ error: '该续借请求不处于待审批状态' });
  }

  if (req.user.max_secret_level < request.secret_level) {
    return res.status(403).json({ error: '审批人权限不足' });
  }

  db.prepare(`
    UPDATE renew_requests 
    SET status = 'rejected', approved_by = ?, approved_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, renewId);

  res.json({
    renew_id: renewId,
    status: 'rejected',
    rejected_by: req.user.id,
    message: '已拒绝续借申请'
  });
});

app.post('/api/overdue/check', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const now = new Date().toISOString();
  const updates = db.prepare(`
    UPDATE borrow_records 
    SET status = 'overdue'
    WHERE status IN ('borrowed', 'approved') 
    AND due_time < ?
  `).run(now);

  res.json({
    message: '逾期检查完成',
    updated_count: updates.changes
  });
});

app.post('/api/overdue/handle', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const { borrow_record_id, action, description } = req.body;

  if (!borrow_record_id || !action) {
    return res.status(400).json({ error: '请提供借阅记录ID和处理动作' });
  }

  if (!['remind', 'penalty', 'force_return'].includes(action)) {
    return res.status(400).json({ error: '处理动作必须是 remind, penalty, force_return 之一' });
  }

  const record = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(borrow_record_id);
  if (!record) {
    return res.status(404).json({ error: '借阅记录不存在' });
  }

  if (record.status !== 'overdue') {
    return res.status(400).json({ error: '该记录不处于逾期状态' });
  }

  const handlingId = uuidv4();
  db.prepare(`
    INSERT INTO overdue_handlings (id, borrow_record_id, handler_id, action, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(handlingId, borrow_record_id, req.user.id, action, description || null);

  if (action === 'force_return') {
    db.prepare(`
      UPDATE borrow_records 
      SET status = 'returned', return_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(borrow_record_id);
  }

  res.json({
    id: handlingId,
    borrow_record_id,
    handler_id: req.user.id,
    action,
    description: description || null,
    message: '逾期处理成功'
  });
});

app.post('/api/documents/:id/destroy', auth.authenticateToken, auth.requireRole('admin'), (req, res) => {
  const { reason, confirmation } = req.body;
  const docId = req.params.id;

  if (!reason) {
    return res.status(400).json({ error: '请提供销毁原因' });
  }

  if (!confirmation || confirmation !== '确认销毁，此操作不可逆') {
    return res.status(400).json({
      error: '不可逆操作确认失败',
      required_confirmation: '确认销毁，此操作不可逆',
      message: '请在请求体中传入 confirmation: \"确认销毁，此操作不可逆\" 以确认此不可逆操作'
    });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
  if (!doc) {
    return res.status(404).json({ error: '资料不存在' });
  }

  if (doc.is_destroyed) {
    return res.status(400).json({ error: '该资料已销毁' });
  }

  const activeBorrow = db.prepare(`
    SELECT id FROM borrow_records 
    WHERE document_id = ? AND status IN ('pending', 'approved', 'borrowed', 'overdue')
    LIMIT 1
  `).get(docId);

  if (activeBorrow) {
    return res.status(400).json({ error: '该资料存在未完成的借阅记录，无法销毁' });
  }

  const destructionId = uuidv4();
  db.prepare(`
    INSERT INTO destruction_records (id, document_id, operator_id, reason, confirmation_note)
    VALUES (?, ?, ?, ?, ?)
  `).run(destructionId, docId, req.user.id, reason, confirmation);

  db.prepare(`
    UPDATE documents 
    SET is_destroyed = 1, destroyed_at = CURRENT_TIMESTAMP, destroyed_by = ?
    WHERE id = ?
  `).run(req.user.id, docId);

  res.json({
    destruction_id: destructionId,
    document_id: docId,
    destroyed_at: new Date().toISOString(),
    destroyed_by: req.user.id,
    reason,
    message: '资料已销毁，操作不可逆'
  });
});

app.get('/api/borrow/history', auth.authenticateToken, (req, res) => {
  const { user_id, document_id } = req.query;

  let query = `
    SELECT br.*, d.title, d.type, d.secret_level, u.username as applicant_username,
           au.username as approver_username
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    LEFT JOIN users au ON br.approved_by = au.id
    WHERE 1=1
  `;
  const params = [];

  if (user_id) {
    query += ' AND br.user_id = ?';
    params.push(user_id);
  }
  if (document_id) {
    query += ' AND br.document_id = ?';
    params.push(document_id);
  }

  if (req.user.role === 'user') {
    query += ' AND br.user_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY br.created_at DESC';

  const records = db.prepare(query).all(...params);
  res.json(records);
});

app.get('/api/statistics/overdue-list', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const records = db.prepare(`
    SELECT br.*, d.title, d.type, d.secret_level, u.username as borrower_username,
           julianday('now') - julianday(br.due_time) as overdue_days
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    WHERE br.status = 'overdue'
    AND d.secret_level <= ?
    ORDER BY br.due_time ASC
  `).all(req.user.max_secret_level);

  const withDays = records.map(r => ({
    ...r,
    overdue_days: Math.floor(r.overdue_days)
  }));

  res.json(withDays);
});

app.get('/api/statistics/secret-distribution', auth.authenticateToken, (req, res) => {
  const distribution = db.prepare(`
    SELECT secret_level, COUNT(*) as count
    FROM documents
    WHERE is_destroyed = 0
    GROUP BY secret_level
    ORDER BY secret_level ASC
  `).all();

  const levelNames = { 0: '公开', 1: '内部', 2: '机密', 3: '绝密' };
  const result = distribution.map(d => ({
    secret_level: d.secret_level,
    level_name: levelNames[d.secret_level],
    count: d.count
  }));

  res.json(result);
});

app.get('/api/statistics/pending-approvals', auth.authenticateToken, auth.requireRole('admin', 'approver'), (req, res) => {
  const borrowPending = db.prepare(`
    SELECT COUNT(*) as borrow_pending_count
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    WHERE br.status = 'pending'
    AND d.secret_level <= ?
  `).get(req.user.max_secret_level);

  const renewPending = db.prepare(`
    SELECT COUNT(*) as renew_pending_count
    FROM renew_requests rr
    JOIN borrow_records br ON rr.borrow_record_id = br.id
    JOIN documents d ON br.document_id = d.id
    WHERE rr.status = 'pending'
    AND d.secret_level <= ?
  `).get(req.user.max_secret_level);

  const borrowList = db.prepare(`
    SELECT br.id, br.document_id, br.user_id, br.request_time, d.title, d.secret_level, d.type, u.username as applicant_username
    FROM borrow_records br
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    WHERE br.status = 'pending'
    AND d.secret_level <= ?
    ORDER BY br.request_time ASC
  `).all(req.user.max_secret_level);

  const renewList = db.prepare(`
    SELECT rr.id, rr.borrow_record_id, rr.user_id, rr.request_time,
           d.title, d.secret_level, d.type,
           u.username as applicant_username
    FROM renew_requests rr
    JOIN borrow_records br ON rr.borrow_record_id = br.id
    JOIN documents d ON br.document_id = d.id
    JOIN users u ON br.user_id = u.id
    WHERE rr.status = 'pending'
    AND d.secret_level <= ?
    ORDER BY rr.request_time ASC
  `).all(req.user.max_secret_level);

  res.json({
    borrow_pending: borrowPending.borrow_pending_count,
    renew_pending: renewPending.renew_pending_count,
    total_pending: borrowPending.borrow_pending_count + renewPending.renew_pending_count,
    borrow_requests: borrowList,
    renew_requests: renewList
  });
});

app.listen(PORT, () => {
  console.log(`📚 资料室借阅逾期 API 服务已启动`);
  console.log(`🌐 服务地址: http://localhost:${PORT}`);
  console.log(`🔑 默认登录账号:`);
  console.log(`   admin / admin123 (管理员, 密级3)`);
  console.log(`   approver / approver123 (审批人, 密级2)`);
  console.log(`   user / user123 (普通用户, 密级1)`);
});
