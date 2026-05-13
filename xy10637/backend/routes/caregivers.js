const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog } = require('../utils/helpers');

router.get('/', (req, res) => {
  db.all('SELECT * FROM caregivers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM caregivers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '陪护人员不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', (req, res) => {
  const { name, phone, id_card, qualifications, skill_level, max_consecutive_hours, max_daily_hours, max_weekly_hours } = req.body;
  const id = generateId();
  const quals = JSON.stringify(qualifications || []);
  
  const sql = `INSERT INTO caregivers (id, name, phone, id_card, qualifications, skill_level, max_consecutive_hours, max_daily_hours, max_weekly_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, name, phone, id_card, quals, skill_level || 1, max_consecutive_hours || 24, max_daily_hours || 12, max_weekly_hours || 60], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('caregiver', id, 'create', `创建陪护人员：${name}`);
      await addAuditLog('caregivers', id, 'insert', null, { name, phone, qualifications });
      res.json({ id, name, phone, qualifications });
    }
  });
});

router.put('/:id', (req, res) => {
  const { name, phone, id_card, qualifications, skill_level, max_consecutive_hours, max_daily_hours, max_weekly_hours, status } = req.body;
  const quals = JSON.stringify(qualifications || []);
  
  db.get('SELECT * FROM caregivers WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const sql = `UPDATE caregivers SET name = ?, phone = ?, id_card = ?, qualifications = ?, skill_level = ?, 
                  max_consecutive_hours = ?, max_daily_hours = ?, max_weekly_hours = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
    db.run(sql, [name, phone, id_card, quals, skill_level, max_consecutive_hours, max_daily_hours, max_weekly_hours, status || 'active', req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: '陪护人员不存在' });
      } else {
        await addTimeLine('caregiver', req.params.id, 'update', `更新陪护人员信息`, oldRow, { name, phone, qualifications, status });
        await addAuditLog('caregivers', req.params.id, 'update', oldRow, { name, phone, qualifications, status });
        res.json({ success: true });
      }
    });
  });
});

module.exports = router;