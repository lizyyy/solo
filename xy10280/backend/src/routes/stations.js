const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const sql = `SELECT s.*, r.name as route_name, r.code as route_code 
               FROM stations s 
               LEFT JOIN routes r ON s.route_id = r.id 
               ORDER BY r.id, s.sequence`;
  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const sql = `SELECT s.*, r.name as route_name, r.code as route_code 
               FROM stations s 
               LEFT JOIN routes r ON s.route_id = r.id 
               WHERE s.id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, code, route_id, sequence, address, longitude, latitude } = req.body;
  const sql = `INSERT INTO stations (name, code, route_id, sequence, address, longitude, latitude) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, code, route_id, sequence, address, longitude, latitude], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, ...req.body });
  });
});

router.put('/:id', (req, res) => {
  const { name, code, route_id, sequence, address, longitude, latitude, status } = req.body;
  const sql = `UPDATE stations SET name=?, code=?, route_id=?, sequence=?, address=?, longitude=?, latitude=?, status=? 
               WHERE id=?`;
  db.run(sql, [name, code, route_id, sequence, address, longitude, latitude, status, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, ...req.body });
  });
});

router.delete('/:id', (req, res) => {
  const sql = 'UPDATE stations SET status = ? WHERE id = ?';
  db.run(sql, ['inactive', req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: req.params.id, message: '站点已停用' });
  });
});

module.exports = router;
