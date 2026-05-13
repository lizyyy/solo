const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const getRechargeOrders = (req, res) => {
  const { status, card_id, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM recharge_orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (card_id) {
    query += ' AND card_id = ?';
    params.push(card_id);
  }
  if (start_date) {
    query += ' AND created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND created_at <= ?';
    params.push(end_date);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, orders) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM recharge_orders', (err, result) => {
      res.json({ success: true, data: orders, total: result.total });
    });
  });
};

const createRecharge = (req, res) => {
  const { card_id, amount, recharge_type, operator, remark } = req.body;
  const orderId = uuidv4();
  const idempotencyKey = req.idempotencyKey || uuidv4();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.run(`INSERT INTO recharge_orders 
      (order_id, card_id, amount, recharge_type, status, operator, remark, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, card_id, amount, recharge_type, 'completed', operator, remark, idempotencyKey],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: err.message });
        }

        db.run('UPDATE cards SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
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
                message: '充值成功', 
                data: { order_id: orderId, card_id, amount }
              });
            });
          }
        );
      }
    );
  });
};

module.exports = {
  getRechargeOrders,
  createRecharge
};
