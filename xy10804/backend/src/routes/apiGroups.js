const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '接口分组名称不能为空' });
  }
  const id = uuidv4();
  db.run(`
    INSERT INTO api_groups (id, name, description)
    VALUES (?, ?, ?)
  `, [id, name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id, name, description });
  });
});

router.get('/', (req, res) => {
  db.all(`SELECT * FROM api_groups ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
