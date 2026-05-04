const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有老人
router.get('/', (req, res) => {
  db.all('SELECT * FROM elderly ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个老人
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM elderly WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '老人信息不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建老人
router.post('/', (req, res) => {
  const { name, age, room, phone, emergency_contact, notes } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO elderly (id, name, age, room, phone, emergency_contact, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, name, age, room, phone, emergency_contact, notes],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id, name, age, room, phone, emergency_contact, notes });
    }
  );
});

// 更新老人
router.put('/:id', (req, res) => {
  const { name, age, room, phone, emergency_contact, notes } = req.body;
  
  db.run(
    `UPDATE elderly 
     SET name = ?, age = ?, room = ?, phone = ?, emergency_contact = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, age, room, phone, emergency_contact, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '老人信息不存在' });
        return;
      }
      res.json({ id: req.params.id, name, age, room, phone, emergency_contact, notes });
    }
  );
});

// 删除老人
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM elderly WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '老人信息不存在' });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
