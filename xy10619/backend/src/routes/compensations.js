const express = require('express');
const router = express.Router();
const db = require('../models/database');

function logModification(tableName, recordId, fieldName, oldValue, newValue, modifiedBy) {
  db.run(`
    INSERT INTO modification_logs (table_name, record_id, field_name, old_value, new_value, modified_by, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [tableName, recordId, fieldName, oldValue, newValue, modifiedBy]);
}

router.get('/lost', (req, res) => {
  db.all(`
    SELECT lc.*, br.reader_id, r.name as reader_name, b.title as book_title,
           s.name as processed_by_name
    FROM lost_compensation lc
    LEFT JOIN borrow_records br ON lc.borrow_record_id = br.id
    LEFT JOIN readers r ON br.reader_id = r.id
    LEFT JOIN books b ON br.book_id = b.id
    LEFT JOIN staff s ON lc.processed_by = s.id
    ORDER BY lc.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.post('/lost', (req, res) => {
  const { borrowRecordId, compensationAmount, compensationType, processedBy, remarks } = req.body;

  db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowRecordId], (err, borrow) => {
    if (err || !borrow) {
      return res.json({ success: false, message: '借阅记录不存在' });
    }

    db.run(`
      INSERT INTO lost_compensation (borrow_record_id, compensation_amount, compensation_type, is_paid, processed_by, remarks)
      VALUES (?, ?, ?, 0, ?, ?)
    `, [borrowRecordId, compensationAmount, compensationType, processedBy, remarks], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        const compensationId = this.lastID;
        
        db.run(`
          INSERT INTO reader_debts (reader_id, borrow_record_id, debt_type, original_amount, reduction_amount, final_amount, is_paid, processed_by, remarks)
          VALUES (?, ?, 'lost', ?, 0, ?, 0, ?, ?)
        `, [borrow.reader_id, borrowRecordId, compensationAmount, compensationAmount, processedBy, remarks || '图书遗失赔偿'], function(err) {
          if (err) {
            res.json({ success: false, message: err.message });
          } else {
            res.json({ success: true, data: { id: compensationId, debtId: this.lastID }, message: '遗失赔偿记录创建成功' });
          }
        });
      }
    });
  });
});

router.put('/lost/:id/pay', (req, res) => {
  const { processedBy } = req.body;
  
  db.get('SELECT * FROM lost_compensation WHERE id = ?', [req.params.id], (err, compensation) => {
    if (err || !compensation) {
      return res.json({ success: false, message: '赔偿记录不存在' });
    }

    if (compensation.is_paid) {
      return res.json({ success: false, message: '该赔偿已完成支付' });
    }

    db.run(`
      UPDATE lost_compensation 
      SET is_paid = 1, paid_date = CURRENT_TIMESTAMP, processed_by = ?
      WHERE id = ?
    `, [processedBy, req.params.id], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        logModification('lost_compensation', req.params.id, 'is_paid', 0, 1, processedBy);

        db.get(`
          SELECT id FROM reader_debts 
          WHERE borrow_record_id = ? AND debt_type = 'lost' AND is_paid = 0
          ORDER BY created_at DESC LIMIT 1
        `, [compensation.borrow_record_id], (err, debt) => {
          if (err) {
            return res.json({ success: false, message: err.message });
          }

          if (debt) {
            db.run(`
              UPDATE reader_debts 
              SET is_paid = 1, paid_date = CURRENT_TIMESTAMP, processed_by = ?, remarks = ?
              WHERE id = ?
            `, [processedBy, '遗失赔偿已支付', debt.id], function(err) {
              if (err) {
                res.json({ success: false, message: err.message });
              } else {
                logModification('reader_debts', debt.id, 'is_paid', 0, 1, processedBy);
                res.json({ success: true, message: '赔偿已支付，欠费已结清', changes: this.changes });
              }
            });
          } else {
            res.json({ success: true, message: '赔偿已支付', changes: this.changes });
          }
        });
      }
    });
  });
});

router.get('/replacement', (req, res) => {
  db.all(`
    SELECT rb.*, lc.borrow_record_id, r.name as reader_name, s.name as accepted_by_name
    FROM replacement_books rb
    LEFT JOIN lost_compensation lc ON rb.lost_compensation_id = lc.id
    LEFT JOIN borrow_records br ON lc.borrow_record_id = br.id
    LEFT JOIN readers r ON br.reader_id = r.id
    LEFT JOIN staff s ON rb.accepted_by = s.id
    ORDER BY rb.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.post('/replacement', (req, res) => {
  const { lostCompensationId, bookTitle, isbn, publisher, remarks } = req.body;

  db.get('SELECT * FROM lost_compensation WHERE id = ?', [lostCompensationId], (err, compensation) => {
    if (err || !compensation) {
      return res.json({ success: false, message: '赔偿记录不存在' });
    }

    db.run(`
      INSERT INTO replacement_books (lost_compensation_id, book_title, isbn, publisher, accept_status, remarks)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [lostCompensationId, bookTitle, isbn, publisher, remarks], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        res.json({ success: true, data: { id: this.lastID }, message: '替代书记录创建成功' });
      }
    });
  });
});

router.put('/replacement/:id/accept', (req, res) => {
  const { acceptedBy, remarks } = req.body;
  
  db.get('SELECT * FROM replacement_books WHERE id = ?', [req.params.id], (err, replacement) => {
    if (err || !replacement) {
      return res.json({ success: false, message: '替代书记录不存在' });
    }

    if (replacement.accept_status === 'accepted') {
      return res.json({ success: false, message: '该替代书已验收' });
    }

    db.run(`
      UPDATE replacement_books 
      SET accept_status = 'accepted', accept_date = CURRENT_TIMESTAMP, accepted_by = ?, remarks = ?
      WHERE id = ?
    `, [acceptedBy, remarks, req.params.id], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        logModification('replacement_books', req.params.id, 'accept_status', 'pending', 'accepted', acceptedBy);

        db.run(`
          UPDATE lost_compensation 
          SET is_paid = 1, paid_date = CURRENT_TIMESTAMP, processed_by = ?, remarks = ?
          WHERE id = ?
        `, [acceptedBy, remarks || '替代书验收通过', replacement.lost_compensation_id], function(err) {
          if (err) {
            res.json({ success: false, message: err.message });
          } else {
            logModification('lost_compensation', replacement.lost_compensation_id, 'is_paid', 0, 1, acceptedBy);

            db.get('SELECT * FROM lost_compensation WHERE id = ?', [replacement.lost_compensation_id], (err, compensation) => {
              if (err) {
                return res.json({ success: false, message: err.message });
              }

              if (compensation) {
                db.get(`
                  SELECT id FROM reader_debts 
                  WHERE borrow_record_id = ? AND debt_type = 'lost' AND is_paid = 0
                  ORDER BY created_at DESC LIMIT 1
                `, [compensation.borrow_record_id], (err, debt) => {
                  if (err) {
                    return res.json({ success: false, message: err.message });
                  }

                  if (debt) {
                    db.run(`
                      UPDATE reader_debts 
                      SET is_paid = 1, paid_date = CURRENT_TIMESTAMP, processed_by = ?, remarks = ?
                      WHERE id = ?
                    `, [acceptedBy, '替代书验收通过，欠费已结清', debt.id], function(err) {
                      if (err) {
                        res.json({ success: false, message: err.message });
                      } else {
                        logModification('reader_debts', debt.id, 'is_paid', 0, 1, acceptedBy);
                        res.json({ success: true, message: '替代书验收成功，欠费已结清' });
                      }
                    });
                  } else {
                    res.json({ success: true, message: '替代书验收成功' });
                  }
                });
              } else {
                res.json({ success: true, message: '替代书验收成功' });
              }
            });
          }
        });
      }
    });
  });
});

router.get('/reduction', (req, res) => {
  db.all(`
    SELECT ra.*, rd.reader_id, rd.debt_type, rd.original_amount, rd.reduction_amount as current_reduction_amount, 
           rd.final_amount, r.name as reader_name, s.name as approved_by_name
    FROM reduction_approvals ra
    LEFT JOIN reader_debts rd ON ra.debt_id = rd.id
    LEFT JOIN readers r ON rd.reader_id = r.id
    LEFT JOIN staff s ON ra.approved_by = s.id
    ORDER BY ra.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.json({ success: false, message: err.message });
    } else {
      res.json({ success: true, data: rows });
    }
  });
});

router.post('/reduction', (req, res) => {
  const { debtId, reductionAmount, reductionReason, remarks } = req.body;

  db.get('SELECT * FROM reader_debts WHERE id = ?', [debtId], (err, debt) => {
    if (err || !debt) {
      return res.json({ success: false, message: '欠费记录不存在' });
    }

    if (debt.is_paid) {
      return res.json({ success: false, message: '该欠费已结清，无法申请减免' });
    }

    const remainingAmount = debt.final_amount - debt.reduction_amount;
    if (parseFloat(reductionAmount) > remainingAmount) {
      return res.json({ success: false, message: `减免金额不能超过剩余欠费金额 ${remainingAmount}` });
    }

    db.run(`
      INSERT INTO reduction_approvals (debt_id, reduction_amount, reduction_reason, approval_status, remarks)
      VALUES (?, ?, ?, 'pending', ?)
    `, [debtId, reductionAmount, reductionReason, remarks], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        res.json({ success: true, data: { id: this.lastID }, message: '减免申请创建成功' });
      }
    });
  });
});

router.put('/reduction/:id/approve', (req, res) => {
  const { approvedBy, remarks } = req.body;
  
  db.get('SELECT * FROM reduction_approvals WHERE id = ?', [req.params.id], (err, approval) => {
    if (err || !approval) {
      return res.json({ success: false, message: '减免申请不存在' });
    }

    if (approval.approval_status === 'approved') {
      return res.json({ success: false, message: '该减免申请已审批' });
    }

    db.run(`
      UPDATE reduction_approvals 
      SET approval_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, remarks = ?
      WHERE id = ?
    `, [approvedBy, remarks, req.params.id], function(err) {
      if (err) {
        res.json({ success: false, message: err.message });
      } else {
        logModification('reduction_approvals', req.params.id, 'approval_status', 'pending', 'approved', approvedBy);

        db.get('SELECT * FROM reader_debts WHERE id = ?', [approval.debt_id], (err, debt) => {
          if (err || !debt) {
            return res.json({ success: false, message: '欠费记录不存在' });
          }

          const oldReductionAmount = debt.reduction_amount;
          const oldFinalAmount = debt.final_amount;
          
          const newReductionAmount = debt.reduction_amount + approval.reduction_amount;
          const newFinalAmount = Math.max(0, debt.original_amount - newReductionAmount);

          db.run(`
            UPDATE reader_debts 
            SET reduction_amount = ?, final_amount = ?, processed_by = ?
            WHERE id = ?
          `, [newReductionAmount, newFinalAmount, approvedBy, approval.debt_id], function(err) {
            if (err) {
              res.json({ success: false, message: err.message });
            } else {
              logModification('reader_debts', approval.debt_id, 'reduction_amount', oldReductionAmount, newReductionAmount, approvedBy);
              logModification('reader_debts', approval.debt_id, 'final_amount', oldFinalAmount, newFinalAmount, approvedBy);
              
              res.json({ 
                success: true, 
                message: '减免审批通过',
                data: {
                  oldReductionAmount,
                  newReductionAmount,
                  oldFinalAmount,
                  newFinalAmount
                }
              });
            }
          });
        });
      }
    });
  });
});

module.exports = router;
