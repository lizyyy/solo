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
  const { readerId, debtType, isPaid, startDate, endDate } = req.query;
  let query = `
    SELECT rd.*, r.name as reader_name, r.student_id, b.title as book_title,
           s.name as processed_by_name
    FROM reader_debts rd
    LEFT JOIN readers r ON rd.reader_id = r.id
    LEFT JOIN borrow_records br ON rd.borrow_record_id = br.id
    LEFT JOIN books b ON br.book_id = b.id
    LEFT JOIN staff s ON rd.processed_by = s.id
    WHERE 1=1
  `;
  const params = [];

  if (readerId) {
    query += ' AND rd.reader_id = ?';
    params.push(readerId);
  }
  if (debtType) {
    query += ' AND rd.debt_type = ?';
    params.push(debtType);
  }
  if (isPaid !== undefined && isPaid !== '') {
    query += ' AND rd.is_paid = ?';
    params.push(isPaid);
  }
  if (startDate) {
    query += ' AND rd.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND rd.created_at <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY rd.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.post('/calculate', (req, res) => {
  const { borrowRecordId, processedBy } = req.body;
  
  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowRecordId], (err, borrow) => {
    if (err || !borrow) {
      return res.json({ success: false, message: '借阅记录不存在' });
    }

    const debts = [];
    
    if (borrow.overdue_fine > 0) {
      debts.push({
        reader_id: borrow.reader_id,
        borrow_record_id: borrowRecordId,
        debt_type: 'overdue',
        original_amount: borrow.overdue_fine,
        reduction_amount: 0,
        final_amount: borrow.overdue_fine,
        is_paid: 0,
        processed_by: processedBy,
        remarks: `逾期${borrow.overdue_days}天费用`
      });
    }
    
    if (borrow.damage_compensation > 0) {
      debts.push({
        reader_id: borrow.reader_id,
        borrow_record_id: borrowRecordId,
        debt_type: 'damage',
        original_amount: borrow.damage_compensation,
        reduction_amount: 0,
        final_amount: borrow.damage_compensation,
        is_paid: 0,
        processed_by: processedBy,
        remarks: '图书破损赔偿'
      });
    }

    if (debts.length === 0) {
      return res.json({ success: true, data: [], message: '没有需要计算的费用' });
    }

    const debtStmt = db.prepare(`
      INSERT INTO reader_debts (reader_id, borrow_record_id, debt_type, original_amount, reduction_amount, final_amount, is_paid, processed_by, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const results = [];
    debts.forEach(debt => {
      debtStmt.run(
        debt.reader_id, debt.borrow_record_id, debt.debt_type,
        debt.original_amount, debt.reduction_amount, debt.final_amount,
        debt.is_paid, debt.processed_by, debt.remarks, function(err) {
          if (!err) {
            results.push({ id: this.lastID, ...debt });
          }
        }
      );
    });
    debtStmt.finalize();

    res.json({ success: true, data: results, message: '欠费计算完成' });
  });
});

router.put('/:id/pay', (req, res) => {
  const { paidDate, processedBy } = req.body;
  
  db.get('SELECT * FROM reader_debts WHERE id = ?', [req.params.id], (err, debt) => {
    if (err || !debt) {
      return res.json({ success: false, message: '欠费记录不存在' });
    }

    if (debt.is_paid) {
      return res.json({ success: false, message: '该欠费已结清' });
    }

    db.run(`
      UPDATE reader_debts 
      SET is_paid = 1, paid_date = ?, processed_by = ?
      WHERE id = ?
    `, [paidDate || new Date().toISOString().split('T')[0], processedBy, req.params.id], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        logModification('reader_debts', req.params.id, 'is_paid', 0, 1, processedBy);
        
        res.json({ 
          success: true, 
          message: '缴费成功', 
          changes: this.changes,
          data: {
            debtId: req.params.id,
            oldStatus: 0,
            newStatus: 1,
            paidDate: paidDate
          }
        });
      }
    });
  });
});

router.get('/summary', (req, res) => {
  const { readerId } = req.query;
  let baseQuery = 'SELECT COUNT(*) as count, SUM(final_amount) as amount FROM reader_debts WHERE 1=1';
  let params = [];
  
  if (readerId) {
    baseQuery += ' AND reader_id = ?';
    params.push(readerId);
  }

  db.get(`${baseQuery} AND is_paid = 0`, params, (err, unpaid) => {
    db.get(`${baseQuery} AND is_paid = 1`, params, (err, paid) => {
      db.all(`
        SELECT debt_type, COUNT(*) as count, SUM(final_amount) as amount
        FROM reader_debts
        ${readerId ? 'WHERE reader_id = ?' : ''}
        GROUP BY debt_type
      `, readerId ? [readerId] : [], (err, byType) => {
        res.json({
          success: true,
          data: {
            unpaid: { count: unpaid.count || 0, amount: unpaid.amount || 0 },
            paid: { count: paid.count || 0, amount: paid.amount || 0 },
            byType: byType || []
          }
        });
      });
    });
  });
});

module.exports = router;
