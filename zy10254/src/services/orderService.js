const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { STATUS, matchTechnician } = require('./rescueService');

function logStatusChange(orderId, fromStatus, toStatus, operatorId = null, remark = null) {
  const logId = uuidv4();
  db.prepare(`
    INSERT INTO order_status_logs (logId, orderId, fromStatus, toStatus, operatorId, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(logId, orderId, fromStatus, toStatus, operatorId, remark);
}

function cancelRescueOrder(orderId, reason, operatorId = null) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消');
  }

  if (order.status === STATUS.SETTLED) {
    throw new Error('工单已结算，无法取消');
  }

  const previousStatus = order.status;
  let rollbackInfo = null;

  if (order.technicianId) {
    db.prepare(`
      UPDATE technicians
      SET status = 'available', currentOrderId = NULL
      WHERE technicianId = ?
    `).run(order.technicianId);
  }

  if (order.membershipId) {
    const membership = db.prepare('SELECT * FROM memberships WHERE membershipId = ?').get(order.membershipId);
    
    const feeRecords = db.prepare(`
      SELECT * FROM fee_records
      WHERE orderId = ? AND type IN ('pre_deduct', 'deduct')
    `).all(orderId);

    if (feeRecords.length > 0) {
      const totalTimesRollback = feeRecords.reduce((sum, r) => sum + (r.timesUsed || 0), 0);
      const totalAmountRollback = feeRecords.reduce((sum, r) => sum + r.amount, 0);

      db.prepare(`
        UPDATE memberships
        SET remainingTimes = remainingTimes + ?
        WHERE membershipId = ?
      `).run(totalTimesRollback, order.membershipId);

      const recordId = uuidv4();
      db.prepare(`
        INSERT INTO fee_records (recordId, orderId, membershipId, type, amount, timesUsed, description)
        VALUES (?, ?, ?, 'rollback', ?, ?, '取消订单-权益回滚')
      `).run(recordId, orderId, order.membershipId, totalAmountRollback, totalTimesRollback);

      rollbackInfo = {
        timesRollback: totalTimesRollback,
        amountRollback: totalAmountRollback,
        remainingTimes: membership.remainingTimes + totalTimesRollback,
        rollbackFrom: feeRecords.map(r => r.type).join(', ')
      };
    }
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, cancelledAt = ?, remark = ?
    WHERE orderId = ?
  `).run(STATUS.CANCELLED, Math.floor(Date.now() / 1000), reason, orderId);

  logStatusChange(orderId, previousStatus, STATUS.CANCELLED, operatorId, reason);

  return {
    orderId,
    status: STATUS.CANCELLED,
    cancelledAt: new Date(),
    reason,
    rollbackInfo
  };
}

function reassignTechnician(orderId, reason, operatorId = null) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    throw new Error('工单不存在');
  }

  if (order.status === STATUS.CANCELLED) {
    throw new Error('工单已取消，无法重派');
  }

  if (order.status === STATUS.SETTLED || order.status === STATUS.COMPLETED) {
    throw new Error('工单已完成，无法重派');
  }

  if (order.status === STATUS.CREATED) {
    throw new Error('工单尚未匹配技师，无需重派');
  }

  const previousTechnicianId = order.technicianId;
  const previousStatus = order.status;

  if (previousTechnicianId) {
    db.prepare(`
      UPDATE technicians
      SET status = 'available', currentOrderId = NULL
      WHERE technicianId = ?
    `).run(previousTechnicianId);
  }

  db.prepare(`
    UPDATE rescue_orders
    SET status = ?, technicianId = NULL, matchedAt = NULL,
        departedAt = NULL, arrivedAt = NULL, reassignCount = reassignCount + 1
    WHERE orderId = ?
  `).run(STATUS.CREATED, orderId);

  logStatusChange(orderId, previousStatus, STATUS.CREATED, operatorId, `重派技师: ${reason}`);

  let newMatch = null;
  try {
    newMatch = matchTechnician(orderId, previousTechnicianId);
  } catch (e) {
    return {
      orderId,
      status: STATUS.CREATED,
      previousTechnicianId,
      reassignCount: order.reassignCount + 1,
      message: '已释放原技师，但暂无新技师可用',
      reason
    };
  }

  return {
    orderId,
    status: newMatch.status,
    previousTechnicianId,
    newTechnician: newMatch.technician,
    reassignCount: order.reassignCount + 1,
    reason,
    preDeductInfo: newMatch.preDeductInfo
  };
}

function getOrderById(orderId) {
  const order = db.prepare('SELECT * FROM rescue_orders WHERE orderId = ?').get(orderId);
  
  if (!order) {
    return null;
  }

  const logs = db.prepare(`
    SELECT * FROM order_status_logs
    WHERE orderId = ?
    ORDER BY createdAt ASC
  `).all(orderId);

  const feeRecords = db.prepare(`
    SELECT * FROM fee_records
    WHERE orderId = ?
    ORDER BY createdAt ASC
  `).all(orderId);

  let technician = null;
  if (order.technicianId) {
    technician = db.prepare('SELECT technicianId, name, phone, rating FROM technicians WHERE technicianId = ?')
      .get(order.technicianId);
  }

  return {
    ...order,
    technician,
    statusLogs: logs,
    feeRecords
  };
}

function getOrdersByVehicle(vehiclePlate) {
  const orders = db.prepare(`
    SELECT * FROM rescue_orders
    WHERE vehiclePlate = ?
    ORDER BY createdAt DESC
  `).all(vehiclePlate);

  return orders;
}

function getAllTechnicians() {
  const technicians = db.prepare('SELECT * FROM technicians').all();
  return technicians.map(tech => ({
    ...tech,
    skills: JSON.parse(tech.skills)
  }));
}

function getMembership(membershipId) {
  const membership = db.prepare('SELECT * FROM memberships WHERE membershipId = ?').get(membershipId);
  
  if (!membership) {
    return null;
  }

  const usageRecords = db.prepare(`
    SELECT fr.*, ro.vehiclePlate, ro.breakdownType
    FROM fee_records fr
    LEFT JOIN rescue_orders ro ON fr.orderId = ro.orderId
    WHERE fr.membershipId = ?
    ORDER BY fr.createdAt DESC
  `).all(membershipId);

  return {
    ...membership,
    usageRecords
  };
}

function getAllOrders(status = null) {
  let query = 'SELECT * FROM rescue_orders ORDER BY createdAt DESC';
  let params = [];

  if (status) {
    query = 'SELECT * FROM rescue_orders WHERE status = ? ORDER BY createdAt DESC';
    params = [status];
  }

  const orders = db.prepare(query).all(...params);
  return orders;
}

module.exports = {
  cancelRescueOrder,
  reassignTechnician,
  getOrderById,
  getOrdersByVehicle,
  getAllTechnicians,
  getMembership,
  getAllOrders
};