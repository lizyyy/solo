const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const getTransactions = (req, res) => {
  const { status, card_id, canteen_id, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM offline_transactions WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (card_id) {
    query += ' AND card_id = ?';
    params.push(card_id);
  }
  if (canteen_id) {
    query += ' AND canteen_id = ?';
    params.push(canteen_id);
  }
  if (start_date) {
    query += ' AND tx_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND tx_time <= ?';
    params.push(end_date);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY tx_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, transactions) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM offline_transactions', (err, result) => {
      res.json({ success: true, data: transactions, total: result.total });
    });
  });
};

const createTransaction = (req, res) => {
  const { card_id, amount, canteen_id, canteen_name, device_id, tx_time, remark } = req.body;
  const txId = uuidv4();
  const idempotencyKey = req.idempotencyKey || uuidv4();

  if (req.duplicateDetected) {
    const dedupId = uuidv4();
    const originalTx = req.duplicateTransactions[0];
    
    db.run(`INSERT INTO duplicate_deductions 
      (dedup_id, card_id, original_tx_id, duplicate_tx_id, confidence, match_criteria, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dedupId, card_id, originalTx.tx_id, txId, 0.95, 'same_card_amount_device_timewindow', 'detected'],
      (err) => {
        if (err) console.error('重复扣款记录创建失败:', err);
      }
    );

    return res.status(409).json({
      success: false,
      message: '检测到疑似重复扣款，已标记待人工审核',
      duplicate_detected: true,
      dedup_id: dedupId
    });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(`INSERT INTO offline_transactions 
      (tx_id, card_id, amount, canteen_id, canteen_name, device_id, tx_time, status, idempotency_key, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, card_id, amount, canteen_id, canteen_name, device_id, tx_time, 'completed', idempotencyKey, remark],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: err.message });
        }

        db.run('UPDATE cards SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
          [amount, card_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              res.status(201).json({ 
                success: true, 
                message: '交易记录成功', 
                data: { tx_id: txId, card_id, amount }
              });
            });
          }
        );
      }
    );
  });
};

const getDuplicateDeductions = (req, res) => {
  const { status, page = 1, pageSize = 20 } = req.query;
  let query = `SELECT dd.*, c.student_name, ot.amount as original_amount, dt.amount as duplicate_amount
    FROM duplicate_deductions dd
    JOIN cards c ON dd.card_id = c.card_id
    JOIN offline_transactions ot ON dd.original_tx_id = ot.tx_id
    JOIN offline_transactions dt ON dd.duplicate_tx_id = dt.tx_id
    WHERE 1=1`;
  const params = [];

  if (status) {
    query += ' AND dd.status = ?';
    params.push(status);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY dd.detected_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, deductions) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM duplicate_deductions', (err, result) => {
      res.json({ success: true, data: deductions, total: result.total });
    });
  });
};

const handleDuplicateDeduction = (req, res) => {
  const { dedup_id, action, handler, remark } = req.body;

  db.get('SELECT * FROM duplicate_deductions WHERE dedup_id = ?', [dedup_id], (err, dedup) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!dedup) return res.status(404).json({ success: false, message: '记录不存在' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      if (action === 'refund') {
        db.run(`UPDATE duplicate_deductions 
          SET status = 'resolved', handler = ?, handle_time = CURRENT_TIMESTAMP, handle_result = 'refund', remark = ?
          WHERE dedup_id = ?`,
          [handler, remark, dedup_id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }
          }
        );

        db.run('UPDATE offline_transactions SET status = ? WHERE tx_id = ?',
          ['invalid', dedup.duplicate_tx_id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }
          }
        );

        db.get('SELECT amount FROM offline_transactions WHERE tx_id = ?', [dedup.duplicate_tx_id], (err, tx) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, message: err.message });
          }

          db.run('UPDATE cards SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
            [tx.amount, dedup.card_id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }

              const refundId = uuidv4();
              db.run(`INSERT INTO refund_records 
                (refund_id, card_id, related_tx_id, amount, refund_type, reason, operator, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [refundId, dedup.card_id, dedup.duplicate_tx_id, tx.amount, 'duplicate_deduction', '重复扣款退款', handler, 'approved'],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ success: false, message: err.message });
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ success: false, message: err.message });
                    }
                    res.json({ success: true, message: '重复扣款已处理，已退款', data: { dedup_id, refund_id: refundId } });
                  });
                }
              );
            }
          );
        });
      } else if (action === 'confirm_normal') {
        db.run(`UPDATE duplicate_deductions 
          SET status = 'resolved', handler = ?, handle_time = CURRENT_TIMESTAMP, handle_result = 'normal_transaction', remark = ?
          WHERE dedup_id = ?`,
          [handler, remark, dedup_id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              res.json({ success: true, message: '已确认为正常交易' });
            });
          }
        );
      }
    });
  });
};

module.exports = {
  getTransactions,
  createTransaction,
  getDuplicateDeductions,
  handleDuplicateDeduction
};
