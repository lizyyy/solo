const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog } = require('../utils/helpers');

router.get('/', (req, res) => {
  db.all('SELECT * FROM wards ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM wards WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '病区不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', (req, res) => {
  const { name, department, level } = req.body;
  const id = generateId();
  
  const sql = 'INSERT INTO wards (id, name, department, level) VALUES (?, ?, ?, ?)';
  db.run(sql, [id, name, department, level || 1], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('ward', id, 'create', `创建病区：${name}`);
      await addAuditLog('wards', id, 'insert', null, { name, department, level });
      res.json({ id, name, department, level });
    }
  });
});

router.put('/:id', (req, res) => {
  const { name, department, level } = req.body;
  
  db.get('SELECT * FROM wards WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const sql = 'UPDATE wards SET name = ?, department = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [name, department, level, req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: '病区不存在' });
      } else {
        await addTimeLine('ward', req.params.id, 'update', `更新病区信息`, oldRow, { name, department, level });
        await addAuditLog('wards', req.params.id, 'update', oldRow, { name, department, level });
        res.json({ success: true });
      }
    });
  });
});

module.exports = router;