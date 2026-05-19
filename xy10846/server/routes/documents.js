const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database/connection');

const VALID_STATUSES = ['pending', 'processing', 'completed', 'archived'];

router.post('/', async (req, res) => {
  try {
    const { title, content, file_type, responsibility_node } = req.body;

    if (!title) {
      return res.status(400).json({
        error: '文档标题不能为空',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await run(
      `INSERT INTO documents (title, content, file_type, responsibility_node, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [title, content || '', file_type || 'markdown', responsibility_node || '']
    );

    const document = await get('SELECT * FROM documents WHERE id = ?', [result.lastID]);

    res.status(201).json(document);
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'DATABASE_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const documents = await all(query, params);

    res.json({ data: documents, total: documents.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const document = await get('SELECT * FROM documents WHERE id = ?', [req.params.id]);

    if (!document) {
      return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
    }

    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `无效状态，有效状态: ${VALID_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }

    const result = await run(
      'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
    }

    const document = await get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM documents WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: '文档不存在', code: 'DOCUMENT_NOT_FOUND' });
    }

    res.json({ message: '删除成功', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
