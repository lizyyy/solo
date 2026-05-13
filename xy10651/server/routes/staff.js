const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

router.get('/', (req, res) => {
  db.all('SELECT * FROM staff ORDER BY name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM staff WHERE id = ?', [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

router.post('/', (req, res) => {
  const { name, phone, skills } = req.body;
  db.run(
    `INSERT INTO staff (name, phone, skills) VALUES (?, ?, ?)`,
    [name, phone, skills],
    async function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        await logAudit('staff', this.lastID, 'create', null, req.body, 1);
        res.json({ id: this.lastID, message: '员工创建成功' });
      }
    }
  );
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM staff WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const { name, phone, skills, status } = req.body;
    db.run(
      `UPDATE staff SET name = ?, phone = ?, skills = ?, status = ? WHERE id = ?`,
      [name, phone, skills, status, req.params.id],
      async function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          await logAudit('staff', req.params.id, 'update', oldRow, req.body, 1);
          res.json({ message: '员工更新成功' });
        }
      }
    );
  });
});

module.exports = router;
