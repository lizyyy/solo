const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.post('/', (req, res) => {
  const { name, max_participants, description } = req.body;
  db.run(
    'INSERT INTO groups (name, max_participants, description) VALUES (?, ?, ?)',
    [name, max_participants || 50, description],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, name, max_participants, description });
    }
  );
});

router.get('/', (req, res) => {
  db.all('SELECT * FROM groups ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM groups WHERE id = ?', [req.params.id], (err, group) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!group) {
      return res.status(404).json({ error: '组别不存在' });
    }
    res.json(group);
  });
});

module.exports = router;
