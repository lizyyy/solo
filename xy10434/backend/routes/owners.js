const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { keyword } = req.query;
  let query = 'SELECT * FROM owners WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  query += ' ORDER BY created_at DESC';
  const owners = db.prepare(query).all(...params);
  res.json(owners);
});

router.post('/', (req, res) => {
  const { name, phone, id_card } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '业主姓名不能为空' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO owners (name, phone, id_card)
      VALUES (?, ?, ?)
    `).run(name, phone, id_card);
    
    const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(owner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, phone, id_card } = req.body;
  const { id } = req.params;

  try {
    db.prepare(`
      UPDATE owners SET name = ?, phone = ?, id_card = ?
      WHERE id = ?
    `).run(name, phone, id_card, id);
    
    const owner = db.prepare('SELECT * FROM owners WHERE id = ?').get(id);
    res.json(owner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  try {
    const decorations = db.prepare(`
      SELECT COUNT(*) as count FROM decorations WHERE owner_id = ?
    `).get(id);
    
    if (decorations.count > 0) {
      return res.status(400).json({ error: '该业主存在装修记录，无法删除' });
    }
    
    db.prepare('DELETE FROM owners WHERE id = ?').run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
