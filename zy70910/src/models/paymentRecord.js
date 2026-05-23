const db = require('../config/database');

const PaymentRecord = {
  create: (record, callback) => {
    const sql = 'INSERT INTO payment_records (payment_id, order_id, payment_time, amount, payment_status, refund_status, refund_amount, payment_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [record.payment_id, record.order_id, record.payment_time, record.amount, record.payment_status, record.refund_status, record.refund_amount, record.payment_channel], callback);
  },
  findById: (paymentId, callback) => {
    db.get('SELECT * FROM payment_records WHERE payment_id = ?', [paymentId], callback);
  },
  findByOrderId: (orderId, callback) => {
    db.all('SELECT * FROM payment_records WHERE order_id = ? ORDER BY payment_time DESC', [orderId], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM payment_records ORDER BY payment_time DESC', callback);
  },
  findByDateRange: (startDate, endDate, callback) => {
    db.all('SELECT * FROM payment_records WHERE payment_time >= ? AND payment_time <= ? ORDER BY payment_time DESC', [startDate, endDate], callback);
  },
  update: (paymentId, record, callback) => {
    const sql = 'UPDATE payment_records SET order_id = ?, payment_time = ?, amount = ?, payment_status = ?, refund_status = ?, refund_amount = ?, payment_channel = ? WHERE payment_id = ?';
    db.run(sql, [record.order_id, record.payment_time, record.amount, record.payment_status, record.refund_status, record.refund_amount, record.payment_channel, paymentId], callback);
  },
  bulkInsert: (records, callback) => {
    const ph = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const vals = records.flatMap(r => [r.payment_id, r.order_id, r.payment_time, r.amount, r.payment_status, r.refund_status, r.refund_amount, r.payment_channel]);
    db.run('INSERT INTO payment_records (payment_id, order_id, payment_time, amount, payment_status, refund_status, refund_amount, payment_channel) VALUES ' + ph, vals, callback);
  }
};

module.exports = PaymentRecord;
