const express = require('express');
const { db } = require('../models/database');

const router = express.Router();

const ROLE_LABELS = {
  STUDENT: '学生',
  ADVISOR: '导师',
  ADMIN: '管理员'
};

router.get('/', (req, res) => {
  const { role } = req.query;
  let query = 'SELECT * FROM users';
  const params = [];
  
  if (role) {
    query += ' WHERE role = ?';
    params.push(role);
  }
  query += ' ORDER BY name';
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const enriched = rows.map(row => ({
      ...row,
      role_label: ROLE_LABELS[row.role] || row.role
    }));
    
    res.json(enriched);
  });
});

router.get('/advisors', (req, res) => {
  db.all("SELECT * FROM users WHERE role = 'ADVISOR' ORDER BY name", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/students', (req, res) => {
  db.all("SELECT * FROM users WHERE role = 'STUDENT' ORDER BY name", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '用户不存在' });
    
    res.json({
      ...row,
      role_label: ROLE_LABELS[row.role] || row.role
    });
  });
});

module.exports = router;
