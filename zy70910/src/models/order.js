const db = require('../config/database');

const Order = {
  create: (order, callback) => {
    const sql = 'INSERT INTO orders (order_id, user_id, charger_id, start_time, end_time, charge_amount, amount, status, platform_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [order.order_id, order.user_id, order.charger_id, order.start_time, order.end_time, order.charge_amount, order.amount, order.status, order.platform_source], callback);
  },
  findById: (orderId, callback) => {
    db.get('SELECT * FROM orders WHERE order_id = ?', [orderId], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM orders ORDER BY start_time DESC', callback);
  },
  findByDateRange: (startDate, endDate, callback) => {
    db.all('SELECT * FROM orders WHERE start_time >= ? AND start_time <= ? ORDER BY start_time DESC', [startDate, endDate], callback);
  },
  update: (orderId, order, callback) => {
    const sql = 'UPDATE orders SET user_id = ?, charger_id = ?, start_time = ?, end_time = ?, charge_amount = ?, amount = ?, status = ?, platform_source = ? WHERE order_id = ?';
    db.run(sql, [order.user_id, order.charger_id, order.start_time, order.end_time, order.charge_amount, order.amount, order.status, order.platform_source, orderId], callback);
  },
  delete: (orderId, callback) => {
    db.run('DELETE FROM orders WHERE order_id = ?', [orderId], callback);
  },
  bulkInsert: (orders, callback) => {
    const ph = orders.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const vals = orders.flatMap(o => [o.order_id, o.user_id, o.charger_id, o.start_time, o.end_time, o.charge_amount, o.amount, o.status, o.platform_source]);
    db.run('INSERT INTO orders (order_id, user_id, charger_id, start_time, end_time, charge_amount, amount, status, platform_source) VALUES ' + ph, vals, callback);
  }
};

module.exports = Order;
