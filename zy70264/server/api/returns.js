const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const RETURN_REASONS = [
  { code: 'T001', name: '温度过低', type: 'temperature', risk: 'high' },
  { code: 'T002', name: '温度过高', type: 'temperature', risk: 'high' },
  { code: 'T003', name: '保温箱温度异常', type: 'temperature', risk: 'medium' },
  { code: 'F001', name: '发现异物', type: 'food_safety', risk: 'high' },
  { code: 'F002', name: '变质异味', type: 'food_safety', risk: 'high' },
  { code: 'F003', name: '外观损坏', type: 'food_safety', risk: 'medium' },
  { code: 'O001', name: '老人不在家', type: 'other', risk: 'low' },
  { code: 'O002', name: '数量不符', type: 'other', risk: 'medium' },
  { code: 'O003', name: '配送延迟', type: 'other', risk: 'medium' }
];

router.get('/reasons', (req, res) => {
  res.json({ success: true, data: RETURN_REASONS });
});

router.get('/batch/:batchId', (req, res) => {
  const returns = db.prepare(`
    SELECT rr.*, sr.elderly_id, sr.elderly_name, sr.address, sr.phone
    FROM return_reasons rr
    JOIN sign_receipts sr ON rr.receipt_id = sr.id
    WHERE sr.batch_id = ?
    ORDER BY rr.created_at DESC
  `).all(req.params.batchId);

  const returnsWithRisk = returns.map(r => {
    const reason = RETURN_REASONS.find(rt => rt.code === r.reason_code);
    return {
      ...r,
      risk_level: reason ? reason.risk : 'low',
      reason_name: reason ? reason.name : r.reason_code
    };
  });

  res.json({ success: true, data: returnsWithRisk });
});

router.get('/pending', (req, res) => {
  const returns = db.prepare(`
    SELECT rr.*, sr.elderly_id, sr.elderly_name, sr.batch_id,
           b.batch_no, b.delivery_date, b.meal_type
    FROM return_reasons rr
    JOIN sign_receipts sr ON rr.receipt_id = sr.id
    JOIN delivery_batches b ON sr.batch_id = b.id
    WHERE rr.status = 'pending'
    ORDER BY rr.created_at DESC
  `).all();

  const returnsWithRisk = returns.map(r => {
    const reason = RETURN_REASONS.find(rt => rt.code === r.reason_code);
    return {
      ...r,
      risk_level: reason ? reason.risk : 'low',
      reason_name: reason ? reason.name : r.reason_code
    };
  });

  res.json({ success: true, data: returnsWithRisk });
});

router.post('/', (req, res) => {
  const id = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const {
    receipt_id, return_type, reason_code, reason_detail,
    meals_returned, return_time, photos, operator
  } = req.body;

  if (!receipt_id || !return_type || !reason_code) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const reason = RETURN_REASONS.find(r => r.code === reason_code);
  if (!reason) {
    return res.status(400).json({ success: false, message: '无效的退餐原因码' });
  }

  const receipt = db.prepare('SELECT * FROM sign_receipts WHERE id = ?').get(receipt_id);
  if (!receipt) {
    return res.status(404).json({ success: false, message: '签收回执不存在' });
  }

  const needsReview = reason.risk === 'high';

  try {
    db.prepare(`
      INSERT INTO return_reasons (
        id, receipt_id, return_type, reason_code, reason_detail,
        meals_returned, return_time, photos, operator, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      receipt_id,
      return_type,
      reason_code,
      reason_detail || null,
      meals_returned || 0,
      return_time || now,
      photos ? JSON.stringify(photos) : null,
      operator || null,
      needsReview ? 'pending' : 'auto_approved',
      now
    );

    const batch = db.prepare('SELECT * FROM delivery_batches WHERE id = ?').get(receipt.batch_id);
    if (batch) {
      const totalReturned = db.prepare(`
        SELECT SUM(rr.meals_returned) as total 
        FROM return_reasons rr
        JOIN sign_receipts sr ON rr.receipt_id = sr.id
        WHERE sr.batch_id = ? AND rr.status IN ('approved', 'auto_approved')
      `).get(receipt.batch_id);
      
      db.prepare('UPDATE delivery_batches SET returned_meals = ?, updated_at = ? WHERE id = ?').run(
        totalReturned.total || 0, now, receipt.batch_id
      );
    }

    res.json({
      success: true,
      data: {
        id,
        needs_review: needsReview,
        risk_level: reason.risk
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/approve', (req, res) => {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const returnReason = db.prepare('SELECT * FROM return_reasons WHERE id = ?').get(req.params.id);
  if (!returnReason) {
    return res.status(404).json({ success: false, message: '退餐记录不存在' });
  }

  if (returnReason.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该记录无需审批' });
  }

  db.prepare('UPDATE return_reasons SET status = ?, operator = ?, created_at = created_at WHERE id = ?').run(
    'approved', req.body.approved_by || '管理员', req.params.id
  );

  const receipt = db.prepare('SELECT * FROM sign_receipts WHERE id = ?').get(returnReason.receipt_id);
  if (receipt) {
    const totalReturned = db.prepare(`
      SELECT SUM(rr.meals_returned) as total 
      FROM return_reasons rr
      JOIN sign_receipts sr ON rr.receipt_id = sr.id
      WHERE sr.batch_id = ? AND rr.status IN ('approved', 'auto_approved')
    `).get(receipt.batch_id);
    
    db.prepare('UPDATE delivery_batches SET returned_meals = ?, updated_at = ? WHERE id = ?').run(
      totalReturned.total || 0, now, receipt.batch_id
    );
  }

  res.json({ success: true });
});

router.post('/:id/reject', (req, res) => {
  const returnReason = db.prepare('SELECT * FROM return_reasons WHERE id = ?').get(req.params.id);
  if (!returnReason) {
    return res.status(404).json({ success: false, message: '退餐记录不存在' });
  }

  if (returnReason.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该记录无需审批' });
  }

  db.prepare('UPDATE return_reasons SET status = ?, operator = ?, created_at = created_at WHERE id = ?').run(
    'rejected', req.body.rejected_by || '管理员', req.params.id
  );

  res.json({ success: true });
});

router.put('/:id', (req, res) => {
  const returnReason = db.prepare('SELECT * FROM return_reasons WHERE id = ?').get(req.params.id);
  if (!returnReason) {
    return res.status(404).json({ success: false, message: '退餐记录不存在' });
  }

  if (returnReason.status !== 'pending') {
    return res.status(400).json({ success: false, message: '只能编辑待审核的记录' });
  }

  const updates = [];
  const values = [];

  Object.keys(req.body).forEach(key => {
    if (['return_type', 'reason_code', 'reason_detail', 'meals_returned', 'operator'].includes(key)) {
      if (key === 'reason_code') {
        const reason = RETURN_REASONS.find(r => r.code === req.body[key]);
        if (!reason) {
          return res.status(400).json({ success: false, message: '无效的退餐原因码' });
        }
      }
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  });

  if (updates.length === 0) {
    return res.json({ success: true, message: '没有需要更新的字段' });
  }

  values.push(req.params.id);

  try {
    db.prepare(`UPDATE return_reasons SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM return_reasons WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
