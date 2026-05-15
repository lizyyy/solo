const express = require('express');
const router = express.Router();
const db = require('../models/database');

function logModification(tableName, recordId, fieldName, oldValue, newValue, modifiedBy) {
  db.run(`
    INSERT INTO modification_logs (table_name, record_id, field_name, old_value, new_value, modified_by, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [tableName, recordId, fieldName, oldValue, newValue, modifiedBy]);
}

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
  const { damage_level_id, is_overdue, overdue_days, overdue_fine, damage_compensation, processed_by, status, return_date } = req.body;
  const borrowId = req.params.id;

  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId], (err, oldRecord) => {
    if (err || !oldRecord) {
      return res.json({ success: false, message: '记录不存在' });
    }

    const newDamageLevelId = damage_level_id !== undefined ? damage_level_id : oldRecord.damage_level_id;
    const newIsOverdue = is_overdue !== undefined ? is_overdue : oldRecord.is_overdue;
    const newOverdueDays = overdue_days !== undefined ? overdue_days : oldRecord.overdue_days;
    const newOverdueFine = overdue_fine !== undefined ? overdue_fine : oldRecord.overdue_fine;
    const newDamageCompensation = damage_compensation !== undefined ? damage_compensation : oldRecord.damage_compensation;
    const newStatus = status !== undefined ? status : oldRecord.status;
    const newReturnDate = return_date !== undefined ? return_date : oldRecord.return_date;
    const processedBy = processed_by !== undefined ? processed_by : oldRecord.processed_by;

    if (oldRecord.damage_level_id !== newDamageLevelId) {
      logModification('borrow_records', borrowId, 'damage_level_id', oldRecord.damage_level_id, newDamageLevelId, processedBy);
    }
    if (oldRecord.is_overdue !== newIsOverdue) {
      logModification('borrow_records', borrowId, 'is_overdue', oldRecord.is_overdue, newIsOverdue, processedBy);
    }
    if (oldRecord.overdue_days !== newOverdueDays) {
      logModification('borrow_records', borrowId, 'overdue_days', oldRecord.overdue_days, newOverdueDays, processedBy);
    }
    if (oldRecord.overdue_fine !== newOverdueFine) {
      logModification('borrow_records', borrowId, 'overdue_fine', oldRecord.overdue_fine, newOverdueFine, processedBy);
    }
    if (oldRecord.damage_compensation !== newDamageCompensation) {
      logModification('borrow_records', borrowId, 'damage_compensation', oldRecord.damage_compensation, newDamageCompensation, processedBy);
    }
    if (oldRecord.status !== newStatus) {
      logModification('borrow_records', borrowId, 'status', oldRecord.status, newStatus, processedBy);
    }

    db.run(`
      UPDATE borrow_records 
      SET damage_level_id = ?, is_overdue = ?, overdue_days = ?, overdue_fine = ?, 
          damage_compensation = ?, processed_by = ?, status = ?, return_date = ?
      WHERE id = ?
    `, [newDamageLevelId, newIsOverdue, newOverdueDays, newOverdueFine, newDamageCompensation, processedBy, newStatus, newReturnDate, borrowId], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        res.json({ 
          success: true, 
          message: '更新成功', 
          changes: this.changes,
          data: {
            oldRecord: {
              damage_level_id: oldRecord.damage_level_id,
              is_overdue: oldRecord.is_overdue,
              overdue_days: oldRecord.overdue_days,
              overdue_fine: oldRecord.overdue_fine,
              damage_compensation: oldRecord.damage_compensation,
              status: oldRecord.status
            },
            newRecord: {
              damage_level_id: newDamageLevelId,
              is_overdue: newIsOverdue,
              overdue_days: newOverdueDays,
              overdue_fine: newOverdueFine,
              damage_compensation: newDamageCompensation,
              status: newStatus
            }
          }
        });
      }
    });
  });
});

module.exports = router;
