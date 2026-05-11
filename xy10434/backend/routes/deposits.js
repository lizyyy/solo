const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { decoration_id, type } = req.query;
  let query = `
    SELECT dt.*,
      d.id as decoration_id,
      r.building, r.unit, r.room_number,
      o.name as owner_name
    FROM deposit_transactions dt
    LEFT JOIN decorations d ON dt.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE 1=1
  `;
  const params = [];
  
  if (decoration_id) {
    query += ' AND dt.decoration_id = ?';
    params.push(decoration_id);
  }
  if (type) {
    query += ' AND dt.type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY dt.created_at DESC';
  const transactions = db.prepare(query).all(...params);
  res.json(transactions);
});

router.post('/', (req, res) => {
  const { decoration_id, type, amount, payment_method, operator, remark } = req.body;
  
  if (!decoration_id || !type || !amount) {
    return res.status(400).json({ error: '装修单ID、类型、金额不能为空' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: '金额必须大于0' });
  }

  try {
    const decoration = db.prepare('SELECT * FROM decorations WHERE id = ?').get(decoration_id);
    if (!decoration) {
      return res.status(404).json({ error: '装修单不存在' });
    }

    if (type === 'deduction') {
      const currentDeposit = db.prepare(`
        SELECT COALESCE(SUM(CASE 
          WHEN type = 'receive' THEN amount 
          WHEN type IN ('refund', 'deduction') THEN -amount 
          ELSE 0 
        END), 0) as total
        FROM deposit_transactions WHERE decoration_id = ?
      `).get(decoration_id);
      
      if (currentDeposit.total < amount) {
        return res.status(400).json({ error: '扣款金额不能超过当前押金余额' });
      }
    }

    const result = db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(decoration_id, type, amount, payment_method, operator, remark);

    if (type === 'deduction') {
      db.prepare(`
        UPDATE decorations SET total_deduction = total_deduction + ? WHERE id = ?
      `).run(amount, decoration_id);
    }
    
    const transaction = db.prepare(`
      SELECT dt.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name
      FROM deposit_transactions dt
      LEFT JOIN decorations d ON dt.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE dt.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/balance/:decoration_id', (req, res) => {
  const { decoration_id } = req.params;
  const result = db.prepare(`
    SELECT COALESCE(SUM(CASE 
      WHEN type = 'receive' THEN amount 
      WHEN type IN ('refund', 'deduction') THEN -amount 
      ELSE 0 
    END), 0) as balance,
    COALESCE(SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END), 0) as total_received,
    COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deduction,
    COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) as total_refund
    FROM deposit_transactions WHERE decoration_id = ?
  `).get(decoration_id);
  
  res.json(result);
});

module.exports = router;
