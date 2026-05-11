const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { decoration_id, status } = req.query;
  let query = `
    SELECT i.*,
      r.building, r.unit, r.room_number,
      o.name as owner_name
    FROM inspections i
    LEFT JOIN decorations d ON i.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE 1=1
  `;
  const params = [];
  
  if (decoration_id) {
    query += ' AND i.decoration_id = ?';
    params.push(decoration_id);
  }
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY i.created_at DESC';
  const inspections = db.prepare(query).all(...params);
  res.json(inspections);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const inspection = db.prepare(`
    SELECT i.*,
      r.building, r.unit, r.room_number,
      o.name as owner_name, o.phone as owner_phone
    FROM inspections i
    LEFT JOIN decorations d ON i.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE i.id = ?
  `).get(id);
  
  if (!inspection) {
    return res.status(404).json({ error: '巡查记录不存在' });
  }
  
  res.json(inspection);
});

router.post('/', (req, res) => {
  const { decoration_id, inspector, inspection_date, violation_type, description, deduction_amount, rectification_requirement } = req.body;
  
  if (!decoration_id) {
    return res.status(400).json({ error: '装修单ID不能为空' });
  }

  try {
    const decoration = db.prepare('SELECT * FROM decorations WHERE id = ?').get(decoration_id);
    if (!decoration) {
      return res.status(404).json({ error: '装修单不存在' });
    }

    const status = violation_type ? 'pending' : 'normal';
    
    const result = db.prepare(`
      INSERT INTO inspections (decoration_id, inspector, inspection_date, violation_type, description, deduction_amount, status, rectification_requirement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decoration_id, 
      inspector, 
      inspection_date || new Date().toISOString(), 
      violation_type, 
      description, 
      deduction_amount || 0,
      status,
      rectification_requirement
    );
    
    if (deduction_amount && deduction_amount > 0) {
      const currentDeposit = db.prepare(`
        SELECT COALESCE(SUM(CASE 
          WHEN type = 'receive' THEN amount 
          WHEN type IN ('refund', 'deduction') THEN -amount 
          ELSE 0 
        END), 0) as total
        FROM deposit_transactions WHERE decoration_id = ?
      `).get(decoration_id);
      
      if (currentDeposit.total < deduction_amount) {
        return res.status(400).json({ error: '扣款金额不能超过当前押金余额' });
      }
      
      db.prepare(`
        INSERT INTO deposit_transactions (decoration_id, type, amount, remark, operator)
        VALUES (?, 'deduction', ?, ?, ?)
      `).run(decoration_id, deduction_amount, `巡查违规扣款: ${violation_type || description || ''}`, inspector);
      
      db.prepare(`
        UPDATE decorations SET total_deduction = total_deduction + ? WHERE id = ?
      `).run(deduction_amount, decoration_id);
    }
    
    const inspection = db.prepare(`
      SELECT i.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name
      FROM inspections i
      LEFT JOIN decorations d ON i.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(inspection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { rectification_result, reviewer } = req.body;

  try {
    const current = db.prepare('SELECT * FROM inspections WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: '巡查记录不存在' });
    }

    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE inspections SET 
        rectification_result = ?, 
        status = 'reviewed',
        reviewer = ?,
        review_date = ?
      WHERE id = ?
    `).run(rectification_result, reviewer, now, id);
    
    const inspection = db.prepare(`
      SELECT i.*,
        r.building, r.unit, r.room_number,
        o.name as owner_name
      FROM inspections i
      LEFT JOIN decorations d ON i.decoration_id = d.id
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      WHERE i.id = ?
    `).get(id);
    
    res.json(inspection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
