const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  const startDate = req.query.startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD');
  const endDate = req.query.endDate || dayjs().format('YYYY-MM-DD');
  const status = req.query.status;

  let query = `SELECT * FROM delivery_batches WHERE delivery_date BETWEEN ? AND ?`;
  const params = [startDate, endDate];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY delivery_date DESC, created_at DESC`;

  const batches = db.prepare(query).all(...params);
  res.json({ success: true, data: batches });
});

router.get('/:id', (req, res) => {
  const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }

  const segments = db.prepare('SELECT * FROM temperature_segments WHERE batch_id = ? ORDER BY start_time').all(req.params.id);
  const receipts = db.prepare('SELECT * FROM sign_receipts WHERE batch_id = ? ORDER BY sign_time').all(req.params.id);
  const returns = db.prepare(`
    SELECT rr.*, sr.elderly_name, sr.elderly_id
    FROM return_reasons rr
    JOIN sign_receipts sr ON rr.receipt_id = sr.id
    WHERE sr.batch_id = ?
    ORDER BY rr.created_at DESC
  `).all(req.params.id);
  const compensations = db.prepare('SELECT * FROM compensations WHERE batch_id = ? ORDER BY created_at DESC').all(req.params.id);
  const incidents = db.prepare('SELECT * FROM safety_incidents WHERE batch_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({
    success: true,
    data: {
      batch,
      segments,
      receipts,
      returns,
      compensations,
      incidents
    }
  });
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    batch_no, delivery_date, meal_type, total_meals,
    distributor, vehicle_no, departure_time
  } = req.body;

  if (!batch_no || !delivery_date || !meal_type) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    db.prepare(`
      INSERT INTO delivery_batches (
        id, batch_no, delivery_date, meal_type, total_meals,
        distributor, vehicle_no, departure_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      batch_no,
      delivery_date,
      meal_type,
      total_meals || 0,
      distributor || null,
      vehicle_no || null,
      departure_time || null,
      now,
      now
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }

  const updates = [];
  const values = [];

  Object.keys(req.body).forEach(key => {
    if (['batch_no', 'delivery_date', 'meal_type', 'total_meals', 'distributor', 'vehicle_no', 'departure_time', 'status'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  });

  if (updates.length === 0) {
    return res.json({ success: true, message: '没有需要更新的字段' });
  }

  updates.push('updated_at = ?');
  values.push(now, req.params.id);

  try {
    db.prepare(`UPDATE delivery_batches SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/complete', (req, res) => {
  const CompensationEngine = require('../services/compensationEngine');
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.prepare('UPDATE delivery_batches SET status = ?, updated_at = ? WHERE id = ?').run('completed', now, req.params.id);

  const compIds = CompensationEngine.autoGenerateCompensations(req.params.id);
  const incidentIds = CompensationEngine.checkAndCreateSafetyIncidents(req.params.id);

  res.json({
    success: true,
    data: {
      compensations_created: compIds.length,
      incidents_created: incidentIds.length
    }
  });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM delivery_batches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
