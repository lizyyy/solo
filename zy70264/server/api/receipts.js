const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

router.get('/batch/:batchId', (req, res) => {
  const receipts = db.prepare(`
    SELECT * FROM sign_receipts 
    WHERE batch_id = ? 
    ORDER BY sign_time
  `).all(req.params.batchId);

  res.json({ success: true, data: receipts });
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    batch_id, elderly_id, elderly_name, address, phone,
    sign_time, sign_type, meals_received, signer_name, signature
  } = req.body;

  if (!batch_id || !elderly_id || !elderly_name) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    db.prepare(`
      INSERT INTO sign_receipts (
        id, batch_id, elderly_id, elderly_name, address, phone,
        sign_time, sign_type, meals_received, signer_name, signature, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      batch_id,
      elderly_id,
      elderly_name,
      address || null,
      phone || null,
      sign_time || now,
      sign_type || 'normal',
      meals_received || 0,
      signer_name || null,
      signature || null,
      now
    );

    const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(batch_id);
    if (batch) {
      const totalDelivered = db.prepare('SELECT SUM(meals_received) as total FROM sign_receipts WHERE batch_id = ?').get(batch_id);
      db.prepare('UPDATE delivery_batches SET delivered_meals = ?, updated_at = ? WHERE id = ?').run(
        totalDelivered.total || 0, now, batch_id
      );
    }

    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const receipt = db.prepare('SELECT * FROM sign_receipts WHERE id = ?').get(req.params.id);
  if (!receipt) {
    return res.status(404).json({ success: false, message: '签收回执不存在' });
  }

  const updates = [];
  const values = [];

  Object.keys(req.body).forEach(key => {
    if (['elderly_name', 'address', 'phone', 'sign_time', 'sign_type', 'meals_received', 'signer_name', 'signature'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  });

  if (updates.length === 0) {
    return res.json({ success: true, message: '没有需要更新的字段' });
  }

  values.push(req.params.id);

  try {
    db.prepare(`UPDATE sign_receipts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(receipt.batch_id);
    if (batch) {
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const totalDelivered = db.prepare('SELECT SUM(meals_received) as total FROM sign_receipts WHERE batch_id = ?').get(receipt.batch_id);
      db.prepare('UPDATE delivery_batches SET delivered_meals = ?, updated_at = ? WHERE id = ?').run(
        totalDelivered.total || 0, now, receipt.batch_id
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const receipt = db.prepare('SELECT * FROM sign_receipts WHERE id = ?').get(req.params.id);
  if (!receipt) {
    return res.status(404).json({ success: false, message: '签收回执不存在' });
  }

  const batchId = receipt.batch_id;
  db.prepare('DELETE FROM sign_receipts WHERE id = ?').run(req.params.id);

  const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(batchId);
  if (batch) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const totalDelivered = db.prepare('SELECT SUM(meals_received) as total FROM sign_receipts WHERE batch_id = ?').get(batchId);
    db.prepare('UPDATE delivery_batches SET delivered_meals = ?, updated_at = ? WHERE id = ?').run(
      totalDelivered.total || 0, now, batchId
    );
  }

  res.json({ success: true });
});

module.exports = router;
