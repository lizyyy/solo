const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const getRefundRecords = (req, res) => {
  const { status, card_id, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM refund_records WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (card_id) {
    query += ' AND card_id = ?';
    params.push(card_id);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, records) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM refund_records', (err, result) => {
      res.json({ success: true, data: records, total: result.total });
    });
  });
};

const createRefund = (req, res) => {
  const { card_id, related_tx_id, related_order_id, amount, refund_type, reason, operator } = req.body;
  const refundId = uuidv4();
  const status = req.requiresReview ? 'pending' : 'approved';

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(`INSERT INTO refund_records 
      (refund_id, card_id, related_tx_id, related_order_id, amount, refund_type, reason, operator, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [refundId, card_id, related_tx_id, related_order_id, amount, refund_type, reason, operator, status],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: err.message });
        }

        if (status === 'approved') {
          db.run('UPDATE cards SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
            [amount, card_id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }

              if (related_tx_id) {
                db.run('UPDATE offline_transactions SET status = ? WHERE tx_id = ?', ['refunded', related_tx_id]);
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, message: err.message });
                }
                res.status(201).json({ 
                  success: true, 
                  message: '退款成功', 
                  data: { refund_id: refundId, status, amount }
                });
              });
            }
          );
        } else {
          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }
            res.status(201).json({ 
              success: true, 
              message: '退款申请已提交，待审核', 
              data: { refund_id: refundId, status: 'pending', amount }
            });
          });
        }
      }
    );
  });
};

const reviewRefund = (req, res) => {
  const { refund_id, action, reviewer, review_remark } = req.body;
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  db.get('SELECT * FROM refund_records WHERE refund_id = ?', [refund_id], (err, refund) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!refund) return res.status(404).json({ success: false, message: '退款记录不存在' });
    if (refund.status !== 'pending') return res.status(400).json({ success: false, message: '该记录无需审核' });

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`UPDATE refund_records 
        SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, review_remark = ?
        WHERE refund_id = ?`,
        [newStatus, reviewer, review_remark, refund_id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, message: err.message });
          }
        }
      );

      if (newStatus === 'approved') {
        db.run('UPDATE cards SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
          [refund.amount, refund.card_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: err.message });
            }

            if (refund.related_tx_id) {
              db.run('UPDATE offline_transactions SET status = ? WHERE tx_id = ?', ['refunded', refund.related_tx_id]);
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              res.json({ success: true, message: '审核通过，已退款' });
            });
          }
        );
      } else {
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ success: false, message: err.message });
          }
          res.json({ success: true, message: '已驳回退款申请' });
        });
      }
    });
  });
};

module.exports = {
  getRefundRecords,
  createRefund,
  reviewRefund
};
