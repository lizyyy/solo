const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog } = require('../utils/helpers');

router.get('/', (req, res) => {
  const sql = `SELECT wd.*, w.name as ward_name FROM ward_demands wd
                LEFT JOIN wards w ON wd.ward_id = w.id
                ORDER BY wd.date DESC, wd.created_at DESC`;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.get('/:id', (req, res) => {
  const sql = `SELECT wd.*, w.name as ward_name FROM ward_demands wd
                LEFT JOIN wards w ON wd.ward_id = w.id
                WHERE wd.id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '病区需求不存在' });
    } else {
      res.json(row);
    }
  });
});

router.post('/', (req, res) => {
  const { ward_id, date, shift_type, required_count, required_qualifications, min_skill_level } = req.body;
  const id = generateId();
  const quals = JSON.stringify(required_qualifications || []);
  
  const sql = `INSERT INTO ward_demands (id, ward_id, date, shift_type, required_count, required_qualifications, min_skill_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, ward_id, date, shift_type, required_count || 1, quals, min_skill_level || 1], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('ward_demand', id, 'create', `创建病区需求：${date} ${shift_type}`);
      await addAuditLog('ward_demands', id, 'insert', null, { ward_id, date, shift_type, required_count });
      res.json({ id, ward_id, date, shift_type });
    }
  });
});

router.post('/batch', (req, res) => {
  const { demands } = req.body;
  const results = [];
  const errors = [];
  
  Promise.all(demands.map(async (demand) => {
    const id = generateId();
    const quals = JSON.stringify(demand.required_qualifications || []);
    
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO ward_demands (id, ward_id, date, shift_type, required_count, required_qualifications, min_skill_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [id, demand.ward_id, demand.date, demand.shift_type, demand.required_count || 1, quals, demand.min_skill_level || 1], async function(err) {
        if (err) {
          errors.push({ demand, error: err.message });
          reject(err);
        } else {
          await addTimeLine('ward_demand', id, 'create', `批量创建病区需求：${demand.date} ${demand.shift_type}`);
          results.push({ id, ...demand });
          resolve();
        }
      });
    });
  }))
  .then(() => {
    res.json({ success: true, imported: results.length, failed: errors.length, errors });
  })
  .catch((err) => {
    res.status(500).json({ error: err.message, imported: results.length, errors });
  });
});

router.put('/:id', (req, res) => {
  const { ward_id, date, shift_type, required_count, required_qualifications, min_skill_level, status } = req.body;
  const quals = JSON.stringify(required_qualifications || []);
  
  db.get('SELECT * FROM ward_demands WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const sql = `UPDATE ward_demands SET ward_id = ?, date = ?, shift_type = ?, required_count = ?,
                  required_qualifications = ?, min_skill_level = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`;
    db.run(sql, [ward_id, date, shift_type, required_count, quals, min_skill_level, status || 'pending', req.params.id], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: '病区需求不存在' });
      } else {
        await addTimeLine('ward_demand', req.params.id, 'update', `更新病区需求信息`, oldRow, { ward_id, date, shift_type, status });
        await addAuditLog('ward_demands', req.params.id, 'update', oldRow, { ward_id, date, shift_type, status });
        res.json({ success: true });
      }
    });
  });
});

module.exports = router;