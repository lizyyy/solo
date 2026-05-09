const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM routes ORDER BY code', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM routes WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, code, direction } = req.body;
  const sql = 'INSERT INTO routes (name, code, direction) VALUES (?, ?, ?)';
  db.run(sql, [name, code, direction], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body });
  });
});

router.put('/:id', (req, res) => {
  const { name, code, direction, status } = req.body;
  const sql = 'UPDATE routes SET name=?, code=?, direction=?, status=? WHERE id=?';
  db.run(sql, [name, code, direction, status, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, ...req.body });
  });
});

router.get('/:id/stations', (req, res) => {
  const sql = 'SELECT * FROM stations WHERE route_id = ? AND status = ? ORDER BY sequence';
  db.all(sql, [req.params.id, 'active'], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
