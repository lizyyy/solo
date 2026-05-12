const { db } = require('../database');
const { generateId, now, logOperation } = require('../utils');
const { getOrderById } = require('./orderService');

async function createSettlement(orderId, operatorId, operatorName) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== 'authorized') {
    throw new Error('只有已授权的订单才能结算');
  }

  const existing = await db.get('SELECT id FROM settlements WHERE order_id = ?', [orderId]);
  if (existing) {
    throw new Error('该订单已生成结算记录');
  }

  const settlementAmount = order.total_amount * 0.9;

  const id = generateId();
  const spot = await db.get('SELECT owner_id FROM parking_spots WHERE id = ?', [order.spot_id]);

  await db.run(
    `INSERT INTO settlements (id, owner_id, order_id, amount, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [id, spot.owner_id, orderId, settlementAmount, now()]
  );

  await logOperation(orderId, 'settlement_created', operatorId, operatorName, { settlementId: id, amount: settlementAmount });

  return getSettlementById(id);
}

async function getSettlementById(id) {
  return await db.get('SELECT * FROM settlements WHERE id = ?', [id]);
}

async function listSettlements(filters = {}) {
  let query = 'SELECT * FROM settlements WHERE 1=1';
  const params = [];

  if (filters.ownerId) {
    query += ' AND owner_id = ?';
    params.push(filters.ownerId);
  }

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY created_at DESC';
  return await db.all(query, params);
}

async function settlePayment(settlementId, operatorId, operatorName) {
  const settlement = await getSettlementById(settlementId);
  if (!settlement) {
    throw new Error('结算记录不存在');
  }

  if (settlement.status !== 'pending') {
    throw new Error('该结算已处理');
  }

  await db.run(
    `UPDATE settlements SET status = 'settled', settled_at = ? WHERE id = ?`,
    [now(), settlementId]
  );

  await logOperation(settlement.order_id, 'settlement_completed', operatorId, operatorName, { settlementId });

  return getSettlementById(settlementId);
}

async function getOwnerSummary(ownerId) {
  const pendingSettlements = await db.get(
    `SELECT SUM(amount) as total FROM settlements WHERE owner_id = ? AND status = 'pending'`,
    [ownerId]
  );

  const settledSettlements = await db.get(
    `SELECT SUM(amount) as total FROM settlements WHERE owner_id = ? AND status = 'settled'`,
    [ownerId]
  );

  const totalOrders = await db.get(
    `SELECT COUNT(*) as count, SUM(total_amount) as total
     FROM orders o
     JOIN parking_spots s ON o.spot_id = s.id
     WHERE s.owner_id = ? AND o.status = 'authorized'`,
    [ownerId]
  );

  return {
    ownerId,
    pendingAmount: pendingSettlements.total || 0,
    settledAmount: settledSettlements.total || 0,
    totalCompletedOrders: totalOrders.count || 0,
    totalRevenue: totalOrders.total || 0
  };
}

module.exports = {
  createSettlement,
  getSettlementById,
  listSettlements,
  settlePayment,
  getOwnerSummary
};
