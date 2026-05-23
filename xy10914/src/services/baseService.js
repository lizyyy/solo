const { runQuery, getOne, getAll } = require('../database');
const { generateNo } = require('../utils/generator');

async function createRider(name, phone, station) {
  const riderNo = generateNo('R');
  const result = await runQuery(
    `INSERT INTO riders (rider_no, name, phone, station, status) VALUES (?, ?, ?, ?, 'active')`,
    [riderNo, name, phone, station]
  );
  return getRiderById(result.id);
}

async function getRiderById(id) {
  return getOne(`SELECT * FROM riders WHERE id = ?`, [id]);
}

async function getAllRiders() {
  return getAll(`SELECT * FROM riders ORDER BY created_at DESC`);
}

async function createOrder(orderNo, riderId, customerName, customerPhone, deliveryAddress, restaurantName, orderAmount, promisedDeliveryTime) {
  const result = await runQuery(
    `INSERT INTO orders (order_no, rider_id, customer_name, customer_phone, delivery_address, restaurant_name, order_amount, promised_delivery_time, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [orderNo || generateNo('ORD'), riderId, customerName, customerPhone, deliveryAddress, restaurantName, orderAmount, promisedDeliveryTime]
  );
  return getOrderById(result.id);
}

async function getOrderById(id) {
  return getOne(
    `SELECT o.*, r.name as rider_name FROM orders o LEFT JOIN riders r ON o.rider_id = r.id WHERE o.id = ?`,
    [id]
  );
}

async function getAllOrders() {
  return getAll(
    `SELECT o.*, r.name as rider_name FROM orders o LEFT JOIN riders r ON o.rider_id = r.id ORDER BY o.created_at DESC`
  );
}

async function createExceptionType(code, name, description, category, severity, requiresEvidence = false) {
  const result = await runQuery(
    `INSERT INTO exception_types (code, name, description, category, severity, requires_evidence)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [code, name, description, category, severity, requiresEvidence ? 1 : 0]
  );
  return getExceptionTypeById(result.id);
}

async function getExceptionTypeById(id) {
  return getOne(`SELECT * FROM exception_types WHERE id = ?`, [id]);
}

async function getExceptionTypeByCode(code) {
  return getOne(`SELECT * FROM exception_types WHERE code = ?`, [code]);
}

async function getAllExceptionTypes() {
  return getAll(`SELECT * FROM exception_types ORDER BY category, severity`);
}

module.exports = {
  createRider,
  getRiderById,
  getAllRiders,
  createOrder,
  getOrderById,
  getAllOrders,
  createExceptionType,
  getExceptionTypeById,
  getExceptionTypeByCode,
  getAllExceptionTypes
};
