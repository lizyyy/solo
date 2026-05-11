const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { status, decoration_id } = req.query;
  let query = `
    SELECT rf.*,
      d.id as decoration_id,
      r.building, r.unit, r.room_number,
      o.name as owner_name, o.phone as owner_phone
    FROM refunds rf
    LEFT JOIN decorations d ON rf.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND rf.status = ?';
    params.push(status);
  }
  if (decoration_id) {
    query += ' AND rf.decoration_id = ?';
    params.push(decoration_id);
  }
  
  query += ' ORDER BY rf.created_at DESC';
  const refunds = db.prepare(query).all(...params);
  res.json(refunds);
});

router.post('/', (req, res) => {
  const { decoration_id, payment_method, applicant, remark } = req.body;
  
  if (!decoration_id) {
    return res.status(400).json({ error: '装修单ID不能为空' });
  }

  try {
    const decoration = db.prepare('SELECT * FROM decorations WHERE id = ?').get(decoration_id);
    if (!decoration) {
      return res.status(404).json({ error: '装修单不存在' });
    }

    const pendingRefund = db.prepare(`
      SELECT COUNT(*) as count FROM refunds 
      WHERE decoration_id = ? AND status = 'pending'
    `).get(decoration_id);
    
    if (pendingRefund.count > 0) {
      return res.status(400).json({ error: '该装修单已有待审核的退押申请' });
    }

    const pendingInspections = db.prepare(`
      SELECT COUNT(*) as count FROM inspections 
      WHERE decoration_id = ? AND status = 'pending'
    `).get(decoration_id);
    
    if (pendingInspections.count > 0) {
      return res.status(400).json({ error: '存在未复核的违规记录，不能申请退押' });
    }

    const balance = db.prepare(`
      SELECT COALESCE(SUM(CASE 
        WHEN type = 'receive' THEN amount 
        WHEN type IN ('refund', 'deduction') THEN -amount 
        ELSE 0 
      END), 0) as balance,
      COALESCE(SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END), 0) as total_received,
      COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deduction
      FROM deposit_transactions WHERE decoration_id = ?
    `).get(decoration_id);
    
    if (balance.balance <= 0) {
      return res.status(400).json({ error: '该装修单无押金可退' });
    }

    const result = db.prepare(`
      INSERT INTO refunds (decoration_id, deposit_received, total_deduction, refund_amount, applicant, payment_method, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      decoration_id, 
      balance.total_received, 
      balance.total_deduction,
      balance.balance,
      applicant,
      payment_method,
      remark
    );

    db.prepare(`
      UPDATE decorations SET status = 'refunding' WHERE id = ?
    `).run(decoration_id);
    
    const refund = db.prepare(`
      SELECT rf.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name, o.phone as owner_phone
      FROM refunds rf
      LEFT JOIN decorations d ON rf.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE rf.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(refund);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/approve', (req, res) => {
  const { id } = req.params;
  const { reviewer } = req.body;

  try {
    const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(id);
    if (!refund) {
      return res.status(404).json({ error: '退押申请不存在' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: '该退押申请已处理' });
    }

    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE refunds SET 
        status = 'approved',
        reviewer = ?,
        review_date = ?
      WHERE id = ?
    `).run(reviewer, now, id);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, operator, remark)
      VALUES (?, 'refund', ?, ?, '退押审核通过')
    `).run(refund.decoration_id, refund.refund_amount, reviewer);

    db.prepare(`
      UPDATE decorations SET status = 'completed' WHERE id = ?
    `).run(refund.decoration_id);
    
    const updatedRefund = db.prepare(`
      SELECT rf.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name, o.phone as owner_phone
      FROM refunds rf
      LEFT JOIN decorations d ON rf.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE rf.id = ?
    `).get(id);
    
    res.json(updatedRefund);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reviewer, remark } = req.body;

  try {
    const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(id);
    if (!refund) {
      return res.status(404).json({ error: '退押申请不存在' });
    }

    if (refund.status !== 'pending') {
      return res.status(400).json({ error: '该退押申请已处理' });
    }

    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE refunds SET 
        status = 'rejected',
        reviewer = ?,
        review_date = ?,
        remark = ?
      WHERE id = ?
    `).run(reviewer, now, remark || refund.remark, id);

    db.prepare(`
      UPDATE decorations SET status = 'in_progress' WHERE id = ?
    `).run(refund.decoration_id);
    
    const updatedRefund = db.prepare(`
      SELECT rf.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name, o.phone as owner_phone
      FROM refunds rf
      LEFT JOIN decorations d ON rf.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE rf.id = ?
    `).get(id);
    
    res.json(updatedRefund);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const refunds = db.prepare(`
      SELECT 
        rf.id as refund_id,
        r.building || '-' || r.unit || '-' || r.room_number as room_no,
        o.name as owner_name,
        o.phone as owner_phone,
        rf.deposit_received,
        rf.total_deduction,
        rf.refund_amount,
        rf.applicant,
        rf.applicant_date,
        rf.payment_method,
        rf.status,
        rf.remark
      FROM refunds rf
      LEFT JOIN decorations d ON rf.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      ORDER BY rf.created_at DESC
    `).all();

    const statusMap = {
      'pending': '待审核',
      'approved': '已通过',
      'rejected': '已拒绝'
    };

    const data = refunds.map(rf => ({
      '退押编号': `TY${String(rf.refund_id).padStart(6, '0')}`,
      '房号': rf.room_no,
      '业主姓名': rf.owner_name,
      '联系电话': rf.owner_phone,
      '已收押金': rf.deposit_received,
      '扣款合计': rf.total_deduction,
      '应退金额': rf.refund_amount,
      '申请人': rf.applicant,
      '申请日期': rf.applicant_date,
      '支付方式': rf.payment_method,
      '状态': statusMap[rf.status] || rf.status,
      '备注': rf.remark
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '退押清单');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=退押清单_${new Date().toISOString().slice(0,10)}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
