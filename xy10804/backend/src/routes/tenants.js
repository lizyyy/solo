const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { name, contact_email } = req.body;
  if (!name) {
    return res.status(400).json({ error: '租户名称不能为空' });
  }
  const id = uuidv4();
  db.run(`
    INSERT INTO tenants (id, name, contact_email, status)
    VALUES (?, ?, ?, 'active')
  `, [id, name, contact_email], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: '租户名称已存在' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id, name, contact_email, status: 'active' });
  });
});

router.get('/', (req, res) => {
  db.all(`SELECT * FROM tenants ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM tenants WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '租户不存在' });
    res.json(row);
  });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'inactive'].includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  db.run(`
    UPDATE tenants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '租户不存在' });
    res.json({ id: req.params.id, status });
  });
});

module.exports = router;
