const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function getCustomers() {
  return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
}

function getCustomerById(id) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function createCustomer(data) {
  const id = uuidv4();
  const now = dayjs().format();
  
  db.prepare(`
    INSERT INTO customers (id, name, phone, address, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.phone, data.address || '', now, now);
  
  return { id, ...data };
}

function updateCustomer(id, data) {
  const now = dayjs().format();
  
  db.prepare(`
    UPDATE customers 
    SET name = ?, phone = ?, address = ?, updated_at = ?
    WHERE id = ?
  `).run(data.name, data.phone, data.address || '', now, id);
  
  return getCustomerById(id);
}

function getCustomerBilling(customerId, startDate, endDate) {
  const orders = db.prepare(`
    SELECT o.*, s.name as ice_spec_name, s.price as ice_spec_price
    FROM orders o
    JOIN ice_specs s ON o.ice_spec_id = s.id
    WHERE o.customer_id = ?
    AND DATE(o.created_at) BETWEEN ? AND ?
    ORDER BY o.created_at DESC
  `).all(customerId, startDate, endDate);
  
  const totalAmount = orders.reduce((sum, o) => sum + (o.status !== 'refunded' ? o.total_amount : 0), 0);
  const totalRefund = orders.reduce((sum, o) => sum + (o.refund_amount || 0), 0);
  const paidAmount = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
  
  return {
    orders,
    summary: {
      totalOrders: orders.length,
      totalAmount,
      totalRefund,
      paidAmount,
      balance: totalAmount - totalRefund - paidAmount
    }
  };
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getCustomerBilling
};
