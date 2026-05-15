const express = require('express');
const router = express.Router();
const db = require('../database/connection');

router.post('/', (req, res) => {
  const { title, content, file_type, responsibility_node } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({
      error: '标题和内容不能为空',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  const stmt = db.prepare(`
    INSERT INTO documents (title, content, file_type, responsibility_node, status)
    VALUES (?, ?, ?, ?, 'draft')
  `);
  
  const result = stmt.run(title, content, file_type || 'markdown', responsibility_node);
  
  res.status(201).json({
    id: result.lastInsertRowid,
    message: '文档创建成功',
    document: {
      id: result.lastInsertRowid,
      title,
      file_type: file_type || 'markdown',
      responsibility_node,
      status: 'draft'
    }
  });
});

router.get('/', (req, res) => {
  const { status, search, limit = 20, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM documents WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (search) {
    query += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const docs = db.prepare(query).all(...params);
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total').split(' ORDER BY')[0];
  const countParams = params.slice(0, -2);
  const { total } = db.prepare(countQuery).get(...countParams);
  
  res.json({
    data: docs,
    pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
  });
});

router.get('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  
  if (!doc) {
    return res.status(404).json({
      error: '文档不存在',
      code: 'DOCUMENT_NOT_FOUND'
    });
  }
  
  res.json(doc);
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'processing', 'completed', 'archived'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: '无效的状态值',
      code: 'INVALID_STATUS'
    });
  }
  
  const result = db.prepare(
    'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({
      error: '文档不存在',
      code: 'DOCUMENT_NOT_FOUND'
    });
  }
  
  res.json({
    message: '状态更新成功',
    document_id: req.params.id,
    new_status: status
  });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({
      error: '文档不存在',
      code: 'DOCUMENT_NOT_FOUND'
    });
  }
  
  res.json({ message: '文档删除成功' });
});

module.exports = router;
