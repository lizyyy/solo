const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

router.get('/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM compensation_rules ORDER BY created_at DESC').all();
  res.json({ success: true, data: rules });
});

router.post('/rules', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    rule_name, trigger_type, trigger_condition,
    compensation_type, compensation_amount, compensation_percent
  } = req.body;

  if (!rule_name || !trigger_type || !trigger_condition || !compensation_type) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  db.prepare(`
    INSERT INTO compensation_rules (
      id, rule_name, trigger_type, trigger_condition,
      compensation_type, compensation_amount, compensation_percent,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    rule_name,
    trigger_type,
    trigger_condition,
    compensation_type,
    compensation_amount || 0,
    compensation_percent || 0,
    now,
    now
  );

  res.json({ success: true, data: { id } });
});

router.put('/rules/:id', (req, res) => {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const updates = [];
  const values = [];

  Object.keys(req.body).forEach(key => {
    if (['rule_name', 'trigger_type', 'trigger_condition', 'compensation_type', 
         'compensation_amount', 'compensation_percent', 'is_active'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  });

  if (updates.length === 0) {
    return res.json({ success: true, message: '没有需要更新的字段' });
  }

  updates.push('updated_at = ?');
  values.push(now, req.params.id);

  db.prepare(`UPDATE compensation_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

router.delete('/rules/:id', (req, res) => {
  db.prepare('DELETE FROM compensation_rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/', (req, res) => {
  const { status, startDate, endDate } = req.query;

  let query = `
    SELECT c.*, b.batch_no, b.delivery_date, b.meal_type
    FROM compensations c
    JOIN delivery_batches b ON c.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  if (startDate && endDate) {
    query += ` AND b.delivery_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY c.created_at DESC`;

  const compensations = db.prepare(query).all(...params);
  res.json({ success: true, data: compensations });
});

router.get('/pending', (req, res) => {
  const compensations = db.prepare(`
    SELECT c.*, b.batch_no, b.delivery_date, b.meal_type
    FROM compensations c
    JOIN delivery_batches b ON c.batch_id = b.id
    WHERE c.status = 'pending'
    ORDER BY c.created_at DESC
  `).all();

  res.json({ success: true, data: compensations });
});

router.post('/:id/approve', (req, res) => {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const compensation = db.prepare('SELECT * FROM compensations WHERE id = ?').get(req.params.id);
  if (!compensation) {
    return res.status(404).json({ success: false, message: '补偿记录不存在' });
  }

  if (compensation.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该记录无需审批' });
  }

  db.prepare(`
    UPDATE compensations 
    SET status = 'approved', approved_by = ?, approval_time = ? 
    WHERE id = ?
  `).run(req.body.approved_by || '管理员', now, req.params.id);

  res.json({ success: true });
});

router.post('/:id/reject', (req, res) => {
  const compensation = db.prepare('SELECT * FROM compensations WHERE id = ?').get(req.params.id);
  if (!compensation) {
    return res.status(404).json({ success: false, message: '补偿记录不存在' });
  }

  if (compensation.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该记录无需审批' });
  }

  db.prepare(`
    UPDATE compensations 
    SET status = 'rejected', approved_by = ? 
    WHERE id = ?
  `).run(req.body.rejected_by || '管理员', req.params.id);

  res.json({ success: true });
});

router.post('/manual', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    batch_id, elderly_id, elderly_name, compensation_type,
    compensation_amount, reason
  } = req.body;

  if (!batch_id || !compensation_type || !compensation_amount || !reason) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  db.prepare(`
    INSERT INTO compensations (
      id, batch_id, elderly_id, elderly_name,
      compensation_type, compensation_amount, reason,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)
  `).run(
    id,
    batch_id,
    elderly_id || null,
    elderly_name || null,
    compensation_type,
    compensation_amount,
    reason,
    now
  );

  res.json({ success: true, data: { id } });
});

module.exports = router;
