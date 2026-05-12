const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

router.post('/', (req, res) => {
  const { name, code, description } = req.body;
  const id = uuidv4();

  db.run(
    `INSERT INTO channels (id, name, code, description) VALUES (?, ?, ?, ?)`,
    [id, name, code, description],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        success: true,
        data: { id, name, code, description }
      });
    }
  );
});

router.get('/', (req, res) => {
  db.all(`SELECT * FROM channels ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM channels WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    res.json({ success: true, data: row });
  });
});

module.exports = router;
