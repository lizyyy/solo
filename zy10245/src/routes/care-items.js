const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../middleware');

router.get('/', (req, res) => {
  const { elder_id, status, type } = req.query;
  let query = 'SELECT * FROM care_items WHERE 1=1';
  const params = [];
  const db = getDb();

  if (elder_id) {
    query += ' AND elder_id = ?';
    params.push(elder_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';
  const items = db.prepare(query).all(...params);
  res.json({ success: true, data: items });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: '护理事项不存在' });
  }
  res.json({ success: true, data: item });
});

router.post('/', logOperation('create', 'care_item'), (req, res) => {
  const { elder_id, type, title, description, scheduled_time, frequency, requires_acknowledgment, created_by } = req.body;
  const id = uuidv4();
  const db = getDb();

  const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(elder_id);
  if (!elder) {
    return res.status(404).json({ success: false, error: '老人不存在' });
  }

  db.prepare(`
    INSERT INTO care_items (id, elder_id, type, title, description, scheduled_time, frequency, requires_acknowledgment, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, elder_id, type, title, description, scheduled_time, frequency, requires_acknowledgment ? 1 : 0, created_by);

  const item = db.prepare('SELECT * FROM care_items WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: item });
});

router.post('/:id/complete', logOperation('complete', 'care_item'), (req, res) => {
  const { performed_by, notes, shift_id } = req.body;
  const db = getDb();
  const item = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);

  if (!item) {
    return res.status(404).json({ success: false, error: '护理事项不存在' });
  }

  if (item.status === 'completed') {
    const recentLog = db.prepare(`
      SELECT * FROM care_item_logs 
      WHERE care_item_id = ? AND action = 'complete' 
      ORDER BY created_at DESC LIMIT 1
    `).get(req.params.id);

    return res.status(409).json({
      success: false,
      error: '该护理事项已完成，请勿重复确认',
      completed_at: recentLog?.created_at,
      completed_by: recentLog?.performed_by
    });
  }

  db.prepare(`
    UPDATE care_items 
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  db.prepare(`
    INSERT INTO care_item_logs (id, care_item_id, shift_id, action, performed_by, notes, request_id)
    VALUES (?, ?, ?, 'complete', ?, ?, ?)
  `).run(uuidv4(), req.params.id, shift_id, performed_by, notes, req.requestId);

  const updated = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.post('/:id/close-without-ack', logOperation('close_without_ack', 'care_item'), (req, res) => {
  const { performed_by, reason, shift_id } = req.body;
  const db = getDb();
  const item = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);

  if (!item) {
    return res.status(404).json({ success: false, error: '护理事项不存在' });
  }

  if (item.requires_acknowledgment) {
    res.locals.blockReason = '该事项需要接班确认，不能直接关闭';
    return res.status(403).json({
      success: false,
      error: '该事项需要接班确认，不能直接关闭'
    });
  }

  db.prepare(`
    UPDATE care_items 
    SET status = 'closed_without_ack', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  db.prepare(`
    INSERT INTO care_item_logs (id, care_item_id, shift_id, action, performed_by, notes, request_id)
    VALUES (?, ?, ?, 'close_without_ack', ?, ?, ?)
  `).run(uuidv4(), req.params.id, shift_id, performed_by, reason, req.requestId);

  const updated = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.post('/:id/cancel', logOperation('cancel', 'care_item'), (req, res) => {
  const { performed_by, reason, shift_id } = req.body;
  const db = getDb();
  const item = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);

  if (!item) {
    return res.status(404).json({ success: false, error: '护理事项不存在' });
  }

  db.prepare(`
    UPDATE care_items 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  db.prepare(`
    INSERT INTO care_item_logs (id, care_item_id, shift_id, action, performed_by, notes, request_id)
    VALUES (?, ?, ?, 'cancel', ?, ?, ?)
  `).run(uuidv4(), req.params.id, shift_id, performed_by, reason, req.requestId);

  const updated = db.prepare('SELECT * FROM care_items WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.get('/:id/logs', (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT * FROM care_item_logs 
    WHERE care_item_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.id);

  res.json({ success: true, data: logs });
});

module.exports = router;
