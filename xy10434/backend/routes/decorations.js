const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { status, room_id, owner_id } = req.query;
  let query = `
    SELECT d.*, 
      r.building, r.unit, r.room_number,
      o.name as owner_name, o.phone as owner_phone,
      ct.name as team_name
    FROM decorations d
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    LEFT JOIN construction_teams ct ON d.team_id = ct.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND d.status = ?';
    params.push(status);
  }
  if (room_id) {
    query += ' AND d.room_id = ?';
    params.push(room_id);
  }
  if (owner_id) {
    query += ' AND d.owner_id = ?';
    params.push(owner_id);
  }
  
  query += ' ORDER BY d.created_at DESC';
  const decorations = db.prepare(query).all(...params);
  res.json(decorations);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const decoration = db.prepare(`
    SELECT d.*, 
      r.building, r.unit, r.room_number,
      o.name as owner_name, o.phone as owner_phone,
      ct.name as team_name, ct.leader_name, ct.leader_phone
    FROM decorations d
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    LEFT JOIN construction_teams ct ON d.team_id = ct.id
    WHERE d.id = ?
  `).get(id);
  
  if (!decoration) {
    return res.status(404).json({ error: '装修单不存在' });
  }
  
  const inspections = db.prepare(`
    SELECT * FROM inspections WHERE decoration_id = ? ORDER BY created_at DESC
  `).all(id);
  
  const depositTransactions = db.prepare(`
    SELECT * FROM deposit_transactions WHERE decoration_id = ? ORDER BY created_at DESC
  `).all(id);
  
  const refunds = db.prepare(`
    SELECT * FROM refunds WHERE decoration_id = ? ORDER BY created_at DESC
  `).all(id);
  
  res.json({
    ...decoration,
    inspections,
    depositTransactions,
    refunds
  });
});

router.post('/', (req, res) => {
  const { room_id, owner_id, team_id, start_date, expected_end_date, deposit_amount, remark } = req.body;
  
  if (!room_id || !owner_id) {
    return res.status(400).json({ error: '房号和业主不能为空' });
  }

  try {
    const activeDecoration = db.prepare(`
      SELECT COUNT(*) as count FROM decorations 
      WHERE room_id = ? AND status NOT IN ('completed', 'cancelled')
    `).get(room_id);
    
    if (activeDecoration.count > 0) {
      return res.status(400).json({ error: '同一房号同时只能有一个进行中的装修单' });
    }

    const result = db.prepare(`
      INSERT INTO decorations (room_id, owner_id, team_id, status, start_date, expected_end_date, deposit_amount, remark)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(room_id, owner_id, team_id, start_date, expected_end_date, deposit_amount || 0, remark);
    
    const decoration = db.prepare(`
      SELECT d.*, 
        r.building, r.unit, r.room_number,
        o.name as owner_name, o.phone as owner_phone,
        ct.name as team_name
      FROM decorations d
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      LEFT JOIN construction_teams ct ON d.team_id = ct.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(decoration);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { room_id, owner_id, team_id, status, start_date, expected_end_date, actual_end_date, deposit_amount, remark } = req.body;

  try {
    const current = db.prepare('SELECT * FROM decorations WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: '装修单不存在' });
    }

    if (room_id && room_id !== current.room_id) {
      const activeDecoration = db.prepare(`
        SELECT COUNT(*) as count FROM decorations 
        WHERE room_id = ? AND status NOT IN ('completed', 'cancelled') AND id != ?
      `).get(room_id, id);
      
      if (activeDecoration.count > 0) {
        return res.status(400).json({ error: '同一房号同时只能有一个进行中的装修单' });
      }
    }

    if (status === 'in_progress') {
      const deposit = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type = 'receive' THEN amount WHEN type = 'refund' THEN -amount ELSE 0 END), 0) as total
        FROM deposit_transactions WHERE decoration_id = ?
      `).get(id);
      
      if (deposit.total <= 0) {
        return res.status(400).json({ error: '未收押金不能开工' });
      }
    }

    db.prepare(`
      UPDATE decorations SET 
        room_id = ?, owner_id = ?, team_id = ?, status = ?, 
        start_date = ?, expected_end_date = ?, actual_end_date = ?, 
        deposit_amount = ?, remark = ?
      WHERE id = ?
    `).run(
      room_id || current.room_id,
      owner_id || current.owner_id,
      team_id || current.team_id,
      status || current.status,
      start_date || current.start_date,
      expected_end_date || current.expected_end_date,
      actual_end_date || current.actual_end_date,
      deposit_amount !== undefined ? deposit_amount : current.deposit_amount,
      remark !== undefined ? remark : current.remark,
      id
    );
    
    const decoration = db.prepare(`
      SELECT d.*, 
        r.building, r.unit, r.room_number,
        o.name as owner_name, o.phone as owner_phone,
        ct.name as team_name
      FROM decorations d
      LEFT JOIN rooms r ON d.room_id = r.id
      LEFT JOIN owners o ON d.owner_id = o.id
      LEFT JOIN construction_teams ct ON d.team_id = ct.id
      WHERE d.id = ?
    `).get(id);
    
    res.json(decoration);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const decoration = db.prepare('SELECT * FROM decorations WHERE id = ?').get(id);
    if (!decoration) {
      return res.status(404).json({ error: '装修单不存在' });
    }

    if (decoration.status !== 'pending') {
      return res.status(400).json({ error: '仅待审批状态的装修单可以删除' });
    }
    
    db.prepare('DELETE FROM deposit_transactions WHERE decoration_id = ?').run(id);
    db.prepare('DELETE FROM inspections WHERE decoration_id = ?').run(id);
    db.prepare('DELETE FROM refunds WHERE decoration_id = ?').run(id);
    db.prepare('DELETE FROM decorations WHERE id = ?').run(id);
    
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams', (req, res) => {
  const { name, leader_name, leader_phone, license } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '施工队名称不能为空' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO construction_teams (name, leader_name, leader_phone, license)
      VALUES (?, ?, ?, ?)
    `).run(name, leader_name, leader_phone, license);
    
    const team = db.prepare('SELECT * FROM construction_teams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teams', (req, res) => {
  const teams = db.prepare('SELECT * FROM construction_teams ORDER BY created_at DESC').all();
  res.json(teams);
});

module.exports = router;
