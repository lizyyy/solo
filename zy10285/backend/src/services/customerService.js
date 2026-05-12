const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function getCustomers(callback) {
  db.all('SELECT * FROM customers ORDER BY created_at DESC', callback);
}

function getCustomerById(id, callback) {
  db.get('SELECT * FROM customers WHERE id = ?', [id], callback);
}

function createCustomer(data, callback) {
  const id = uuidv4();
  const now = dayjs().format();
  
  db.run(`
    INSERT INTO customers (id, name, phone, address, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `, [id, data.name, data.phone, data.address || '', now, now], function(err) {
    if (err) return callback(err);
    callback(null, { id, ...data });
  });
}

function updateCustomer(id, data, callback) {
  const now = dayjs().format();
  
  db.run(`
    UPDATE customers 
    SET name = ?, phone = ?, address = ?, updated_at = ?
    WHERE id = ?
  `, [data.name, data.phone, data.address || '', now, id], function(err) {
    if (err) return callback(err);
    getCustomerById(id, callback);
  });
}

function getCustomerBilling(customerId, startDate, endDate, callback) {
  db.all(`
    SELECT o.*, s.name as ice_spec_name, s.price as ice_spec_price,
           sl.date as delivery_date, sl.start_time, sl.end_time
    FROM orders o
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    WHERE o.customer_id = ?
    AND DATE(o.created_at) BETWEEN ? AND ?
    ORDER BY o.created_at DESC
  `, [customerId, startDate, endDate], (err, orders) => {
    if (err) return callback(err);
    
    const totalAmount = orders.reduce((sum, o) => sum + (o.status !== 'refunded' ? o.total_amount : 0), 0);
    const totalRefund = orders.reduce((sum, o) => sum + (o.refund_amount || 0), 0);
    const paidAmount = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    
    callback(null, {
      orders,
      summary: {
        totalOrders: orders.length,
        totalAmount,
        totalRefund,
        paidAmount,
        balance: totalAmount - totalRefund - paidAmount
      }
    });
  });
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getCustomerBilling
};
