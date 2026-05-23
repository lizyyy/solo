const express = require('express');
const Joi = require('joi');
const db = require('../utils/database');
const { updateErrorHandling } = require('../middleware/errorHandler');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

const handleErrorSchema = Joi.object({
  handlingResult: Joi.string().required(),
  handledBy: Joi.string().required()
});

router.get('/', (req, res) => {
  const { handled, limit = 100, offset = 0 } = req.query;
  let query = 'SELECT * FROM error_logs WHERE 1=1';
  const params = [];

  if (handled === 'true') {
    query += ' AND handling_result IS NOT NULL';
  } else if (handled === 'false') {
    query += ' AND handling_result IS NULL';
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM error_logs').get();

  res.json({ success: true, data: logs, total: total.count });
});

router.get('/:id', (req, res) => {
  const log = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(parseInt(req.params.id));
  if (!log) {
    return res.status(404).json({ success: false, error: '错误日志不存在' });
  }
  res.json({ success: true, data: log });
});

router.put('/:id/handle', (req, res) => {
  const validationResult = validateRequest(handleErrorSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '错误日志不存在' });
  }

  const result = updateErrorHandling(id, value.handlingResult, value.handledBy);
  
  if (result) {
    const log = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(id);
    res.json({ success: true, data: log });
  } else {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM error_logs WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '错误日志不存在' });
  }

  db.prepare('DELETE FROM error_logs WHERE id = ?').run(id);
  res.json({ success: true, message: '错误日志已删除' });
});

module.exports = router;
