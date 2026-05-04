const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 获取所有交接记录
router.get('/', (req, res) => {
  const query = `
    SELECT h.*, m.name as medicine_name
    FROM handover_records h
    LEFT JOIN medicines m ON h.medicine_id = m.id
    ORDER BY h.handover_time DESC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 获取单个交接记录
router.get('/:id', (req, res) => {
  const query = `
    SELECT h.*, m.name as medicine_name
    FROM handover_records h
    LEFT JOIN medicines m ON h.medicine_id = m.id
    WHERE h.id = ?
  `;
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '交接记录不存在' });
      return;
    }
    res.json(row);
  });
});

// 创建交接记录
router.post('/', (req, res) => {
  const { medicine_id, from_volunteer, to_volunteer, quantity, notes } = req.body;
  const id = uuidv4();
  
  db.run(
    `INSERT INTO handover_records 
     (id, medicine_id, from_volunteer, to_volunteer, quantity, handover_time, notes)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [id, medicine_id, from_volunteer, to_volunteer, quantity, notes],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ 
        id, 
        medicine_id, 
        from_volunteer, 
        to_volunteer, 
        quantity, 
        notes 
      });
    }
  );
});

// 更新交接记录
router.put('/:id', (req, res) => {
  const { medicine_id, from_volunteer, to_volunteer, quantity, notes } = req.body;
  
  db.run(
    `UPDATE handover_records 
     SET medicine_id = ?, from_volunteer = ?, to_volunteer = ?, quantity = ?, notes = ?
     WHERE id = ?`,
    [medicine_id, from_volunteer, to_volunteer, quantity, notes, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '交接记录不存在' });
        return;
      }
      res.json({ 
        id: req.params.id, 
        medicine_id, 
        from_volunteer, 
        to_volunteer, 
        quantity, 
        notes 
      });
    }
  );
});

// 删除交接记录
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM handover_records WHERE id = ?', [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '交接记录不存在' });
      return;
    }
    res.json({ message: '删除成功' });
  });
});

module.exports = router;
