const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { building, unit, status } = req.query;
  let query = `
    SELECT r.*, o.name as owner_name, o.phone as owner_phone
    FROM rooms r
    LEFT JOIN owners o ON r.owner_id = o.id
    WHERE 1=1
  `;
  const params = [];
  
  if (building) {
    query += ' AND r.building = ?';
    params.push(building);
  }
  if (unit) {
    query += ' AND r.unit = ?';
    params.push(unit);
  }
  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY r.building, r.unit, r.room_number';
  const rooms = db.prepare(query).all(...params);
  res.json(rooms);
});

router.post('/', (req, res) => {
  const { building, unit, room_number, owner_id, status } = req.body;
  
  if (!building || !unit || !room_number) {
    return res.status(400).json({ error: '楼栋、单元、房号不能为空' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO rooms (building, unit, room_number, owner_id, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(building, unit, room_number, owner_id, status || 'empty');
    
    const room = db.prepare(`
      SELECT r.*, o.name as owner_name, o.phone as owner_phone
      FROM rooms r
      LEFT JOIN owners o ON r.owner_id = o.id
      WHERE r.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(room);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '该房号已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { building, unit, room_number, owner_id, status } = req.body;
  const { id } = req.params;

  try {
    db.prepare(`
      UPDATE rooms SET building = ?, unit = ?, room_number = ?, owner_id = ?, status = ?
      WHERE id = ?
    `).run(building, unit, room_number, owner_id, status, id);
    
    const room = db.prepare(`
      SELECT r.*, o.name as owner_name, o.phone as owner_phone
      FROM rooms r
      LEFT JOIN owners o ON r.owner_id = o.id
      WHERE r.id = ?
    `).get(id);
    
    res.json(room);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '该房号已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const decorations = db.prepare(`
      SELECT COUNT(*) as count FROM decorations WHERE room_id = ?
    `).get(id);
    
    if (decorations.count > 0) {
      return res.status(400).json({ error: '该房屋存在装修记录，无法删除' });
    }
    
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/buildings', (req, res) => {
  const buildings = db.prepare(`
    SELECT DISTINCT building FROM rooms ORDER BY building
  `).all();
  res.json(buildings.map(b => b.building));
});

router.get('/units/:building', (req, res) => {
  const { building } = req.params;
  const units = db.prepare(`
    SELECT DISTINCT unit FROM rooms WHERE building = ? ORDER BY unit
  `).all(building);
  res.json(units.map(u => u.unit));
});

module.exports = router;
