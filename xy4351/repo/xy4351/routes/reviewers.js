const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM reviewers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM reviewers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '复核人不存在' });
    }
    res.json(row);
  });
});

router.get('/status/:status', (req, res) => {
  db.all('SELECT * FROM reviewers WHERE status = ? ORDER BY name', [req.params.status], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, role, contact, status } = req.body;
  
  const stmt = db.prepare(`
    INSERT INTO reviewers (name, role, contact, status)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(
    name,
    role,
    contact || null,
    status || '在职',
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '复核人创建成功'
      });
    }
  );
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const { name, role, contact, status } = req.body;
  
  const stmt = db.prepare(`
    UPDATE reviewers 
    SET name = ?, role = ?, contact = ?, status = ?
    WHERE id = ?
  `);
  
  stmt.run(
    name,
    role,
    contact || null,
    status || '在职',
    req.params.id,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '复核人不存在' });
      }
      res.json({ message: '复核人更新成功' });
    }
  );
  stmt.finalize();
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM reviewers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '复核人不存在' });
    }
    res.json({ message: '复核人删除成功' });
  });
});

module.exports = router;
