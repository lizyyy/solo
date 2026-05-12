const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

router.post('/', (req, res) => {
  const { bed_number, ward, floor, status = 'active' } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO beds (id, bed_number, ward, floor, status) VALUES (?, ?, ?, ?, ?)',
    [id, bed_number, ward, floor, status],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ success: false, message: '床位号已存在' });
        }
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      res.status(201).json({
        success: true,
        data: { id, bed_number, ward, floor, status }
      });
    }
  );
});

router.get('/', (req, res) => {
  const { ward, floor, status } = req.query;
  let query = 'SELECT * FROM beds WHERE 1=1';
  const params = [];
  
  if (ward) {
    query += ' AND ward = ?';
    params.push(ward);
  }
  if (floor) {
    query += ' AND floor = ?';
    params.push(floor);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM beds WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '床位不存在' });
    }
    res.json({ success: true, data: row });
  });
});

router.put('/:id', (req, res) => {
  const { bed_number, ward, floor, status } = req.body;
  db.run(
    'UPDATE beds SET bed_number = ?, ward = ?, floor = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [bed_number, ward, floor, status, req.params.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ success: false, message: '床位号已存在' });
        }
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: '床位不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    }
  );
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM beds WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: '床位不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  });
});

router.get('/:id/devices', (req, res) => {
  db.all(
    'SELECT * FROM devices WHERE current_bed_id = ?',
    [req.params.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '数据库错误', error: err.message });
      }
      res.json({ success: true, data: rows });
    }
  );
});

module.exports = router;
