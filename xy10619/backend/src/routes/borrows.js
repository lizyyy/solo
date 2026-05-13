const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/', (req, res) => {
  const { readerId, status, startDate, endDate } = req.query;
  let query = `
    SELECT br.*, r.name as reader_name, r.student_id, b.title as book_title, b.price, 
           dl.level_name as damage_level_name, s.name as processed_by_name
    FROM borrow_records br
    LEFT JOIN readers r ON br.reader_id = r.id
    LEFT JOIN books b ON br.book_id = b.id
    LEFT JOIN damage_levels dl ON br.damage_level_id = dl.id
    LEFT JOIN staff s ON br.processed_by = s.id
    WHERE 1=1
  `;
  const params = [];

  if (readerId) {
    query += ' AND br.reader_id = ?';
    params.push(readerId);
  }
  if (status) {
    query += ' AND br.status = ?';
    params.push(status);
  }
  if (startDate) {
    query += ' AND br.borrow_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND br.borrow_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY br.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT br.*, r.name as reader_name, r.student_id, b.title as book_title, b.price,
           dl.level_name as damage_level_name, s.name as processed_by_name
    FROM borrow_records br
    LEFT JOIN readers r ON br.reader_id = r.id
    LEFT JOIN books b ON br.book_id = b.id
    LEFT JOIN damage_levels dl ON br.damage_level_id = dl.id
    LEFT JOIN staff s ON br.processed_by = s.id
    WHERE br.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: row });
    }
  });
});

router.put('/:id', (req, res) => {
  const { damage_level_id, is_overdue, overdue_days, overdue_fine, damage_compensation, processed_by, status } = req.body;
  const borrowId = req.params.id;

  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId], (err, oldRecord) => {
    if (err || !oldRecord) {
      return res.json({ success: false, message: '记录不存在' });
    }

    const logStmt = db.prepare('INSERT INTO modification_logs (table_name, record_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)');
    
    if (oldRecord.damage_level_id !== damage_level_id) {
      logStmt.run('borrow_records', borrowId, 'damage_level_id', oldRecord.damage_level_id, damage_level_id, processed_by);
    }
    if (oldRecord.overdue_days !== overdue_days) {
      logStmt.run('borrow_records', borrowId, 'overdue_days', oldRecord.overdue_days, overdue_days, processed_by);
    }
    if (oldRecord.overdue_fine !== overdue_fine) {
      logStmt.run('borrow_records', borrowId, 'overdue_fine', oldRecord.overdue_fine, overdue_fine, processed_by);
    }
    if (oldRecord.damage_compensation !== damage_compensation) {
      logStmt.run('borrow_records', borrowId, 'damage_compensation', oldRecord.damage_compensation, damage_compensation, processed_by);
    }
    logStmt.finalize();

    db.run(`
      UPDATE borrow_records 
      SET damage_level_id = ?, is_overdue = ?, overdue_days = ?, overdue_fine = ?, 
          damage_compensation = ?, processed_by = ?, status = ?
      WHERE id = ?
    `, [damage_level_id, is_overdue, overdue_days, overdue_fine, damage_compensation, processed_by, status, borrowId], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        res.json({ success: true, message: '更新成功', changes: this.changes });
      }
    });
  });
});

module.exports = router;
