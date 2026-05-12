const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');

function generateId() {
  return uuidv4();
}

function now() {
  return Date.now();
}

async function logOperation(orderId, operation, operatorId, operatorName, details = {}) {
  await db.run(
    `INSERT INTO operation_logs (order_id, operation, operator_id, operator_name, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, operation, operatorId, operatorName, JSON.stringify(details), now()]
  );
}

function calculateHours(startTime, endTime) {
  const diffMs = endTime - startTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.ceil(diffHours * 100) / 100;
}

async function checkTimeConflict(spotId, startTime, endTime, excludeOrderId = null) {
  let query = `
    SELECT id, spot_number, start_time, end_time, status
    FROM orders
    WHERE spot_id = ?
      AND status NOT IN ('cancelled', 'refunded')
      AND (
        (start_time < ? AND end_time > ?)
        OR (start_time >= ? AND start_time < ?)
        OR (end_time > ? AND end_time <= ?)
      )
  `;
  const params = [spotId, endTime, startTime, startTime, endTime, startTime, endTime];

  if (excludeOrderId) {
    query += ' AND id != ?';
    params.push(excludeOrderId);
  }

  const conflicts = await db.all(query, params);
  return conflicts;
}

async function checkLicensePlateActiveOrders(licensePlate, excludeOrderId = null) {
  let query = `
    SELECT id, spot_number, start_time, end_time, status
    FROM orders
    WHERE license_plate = ?
      AND status IN ('paid', 'authorized')
  `;
  const params = [licensePlate];

  if (excludeOrderId) {
    query += ' AND id != ?';
    params.push(excludeOrderId);
  }

  return await db.all(query, params);
}

module.exports = {
  generateId,
  now,
  logOperation,
  calculateHours,
  checkTimeConflict,
  checkLicensePlateActiveOrders
};
