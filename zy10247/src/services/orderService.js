const { db } = require('../database');
const { generateId, now, logOperation, calculateHours, checkTimeConflict } = require('../utils');
const { getParkingSpotById } = require('./parkingSpotService');

async function createOrder(data) {
  const { spotId, renterId, renterName, licensePlate, startTime, endTime } = data;

  if (startTime >= endTime) {
    throw new Error('开始时间必须早于结束时间');
  }

  const spot = await getParkingSpotById(spotId);
  if (!spot) {
    throw new Error('车位不存在');
  }

  if (spot.status !== 'available') {
    throw new Error('车位不可用');
  }

  const conflicts = await checkTimeConflict(spotId, startTime, endTime);
  if (conflicts.length > 0) {
    throw new Error(`时间段冲突，与订单 ${conflicts[0].id} 重叠`);
  }

  const hours = calculateHours(startTime, endTime);
  const totalAmount = hours * spot.price_per_hour;

  const id = generateId();
  await db.run(
    `INSERT INTO orders (
      id, spot_id, spot_number, renter_id, renter_name, license_plate,
      start_time, end_time, total_amount, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, spotId, spot.spot_number, renterId, renterName, licensePlate,
     startTime, endTime, totalAmount, now(), now()]
  );

  await logOperation(id, 'create_order', renterId, renterName, { spotNumber: spot.spot_number, licensePlate });

  return getOrderById(id);
}

async function getOrderById(id) {
  return await db.get('SELECT * FROM orders WHERE id = ?', [id]);
}

async function listOrders(filters = {}) {
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (filters.renterId) {
    query += ' AND renter_id = ?';
    params.push(filters.renterId);
  }

  if (filters.spotId) {
    query += ' AND spot_id = ?';
    params.push(filters.spotId);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.licensePlate) {
    query += ' AND license_plate = ?';
    params.push(filters.licensePlate);
  }

  query += ' ORDER BY created_at DESC';
  return await db.all(query, params);
}

async function payOrder(orderId, data) {
  const { paymentMethod, transactionId, operatorId, operatorName } = data;

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== 'pending') {
    throw new Error('订单状态不允许支付');
  }

  if (transactionId) {
    const existing = await db.get('SELECT id FROM orders WHERE payment_transaction_id = ?', [transactionId]);
    if (existing) {
      throw new Error('该交易号已被使用，防止重复支付');
    }
  }

  await db.run(
    `UPDATE orders
     SET status = 'paid', paid_at = ?, payment_method = ?, payment_transaction_id = ?, updated_at = ?
     WHERE id = ?`,
    [now(), paymentMethod, transactionId, now(), orderId]
  );

  await logOperation(orderId, 'payment_confirm', operatorId, operatorName, { transactionId, amount: order.total_amount });

  return getOrderById(orderId);
}

async function authorizeOrder(orderId, operatorId, operatorName) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== 'paid') {
    throw new Error('只有已支付的订单才能授权');
  }

  const conflicts = await checkTimeConflict(order.spot_id, order.start_time, order.end_time, orderId);
  if (conflicts.length > 0) {
    throw new Error(`授权失败，时间段与订单 ${conflicts[0].id} 冲突`);
  }

  const authId = generateId();
  await db.run(
    `INSERT INTO access_authorizations (id, order_id, license_plate, start_time, end_time, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [authId, orderId, order.license_plate, order.start_time, order.end_time, now()]
  );

  await db.run(
    `UPDATE orders SET status = 'authorized', authorized_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), orderId]
  );

  await logOperation(orderId, 'access_granted', operatorId, operatorName, { authId, licensePlate: order.license_plate });

  return { order: await getOrderById(orderId), authorization: await getAuthorizationById(authId) };
}

async function getAuthorizationById(id) {
  return await db.get('SELECT * FROM access_authorizations WHERE id = ?', [id]);
}

async function cancelOrder(orderId, operatorId, operatorName) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw new Error('订单已取消或已退款');
  }

  const activeAuth = await db.get(
    `SELECT * FROM access_authorizations WHERE order_id = ? AND status = 'active'`,
    [orderId]
  );

  if (activeAuth) {
    await db.run(
      `UPDATE access_authorizations SET status = 'revoked', revoked_at = ? WHERE id = ?`,
      [now(), activeAuth.id]
    );
    await logOperation(orderId, 'access_revoked', operatorId, operatorName, { authId: activeAuth.id });
  }

  await db.run(
    `UPDATE orders SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), orderId]
  );

  await logOperation(orderId, 'order_cancelled', operatorId, operatorName);

  return getOrderById(orderId);
}

async function refundOrder(orderId, data) {
  const { operatorId, operatorName, refundAmount } = data;

  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== 'paid' && order.status !== 'authorized') {
    throw new Error('只有已支付或已授权的订单才能退款');
  }

  const activeAuth = await db.get(
    `SELECT * FROM access_authorizations WHERE order_id = ? AND status = 'active'`,
    [orderId]
  );

  if (activeAuth) {
    await db.run(
      `UPDATE access_authorizations SET status = 'revoked', revoked_at = ? WHERE id = ?`,
      [now(), activeAuth.id]
    );
    await logOperation(orderId, 'access_revoked', operatorId, operatorName, { authId: activeAuth.id });
  }

  const actualRefund = refundAmount || order.total_amount;

  await db.run(
    `UPDATE orders SET status = 'refunded', refunded_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), orderId]
  );

  await logOperation(orderId, 'refund_processed', operatorId, operatorName, { refundAmount: actualRefund });

  return getOrderById(orderId);
}

async function listAuthorizations(status = null) {
  let query = 'SELECT * FROM access_authorizations';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  return await db.all(query, params);
}

module.exports = {
  createOrder,
  getOrderById,
  listOrders,
  payOrder,
  authorizeOrder,
  cancelOrder,
  refundOrder,
  listAuthorizations,
  getAuthorizationById
};
