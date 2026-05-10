const { getDatabase } = require('../database/init');
const { generateId, generateOrderNo } = require('../utils/idGenerator');
const { ORDER_STATUS, ORDER_STATUS_FLOW, MODULES } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');

function validateOrderData(data) {
  const errors = [];
  if (!data.venue_id) errors.push('venue_id不能为空');
  if (!data.venue_name) errors.push('venue_name不能为空');
  if (!data.customer_name) errors.push('customer_name不能为空');
  if (!data.rental_start_time) errors.push('rental_start_time不能为空');
  if (!data.rental_end_time) errors.push('rental_end_time不能为空');
  if (data.deposit_amount === undefined || data.deposit_amount < 0) {
    errors.push('deposit_amount不能为空且不能为负数');
  }
  return errors;
}

function createOrder(data, operator) {
  const db = getDatabase();
  const errors = validateOrderData(data);
  
  if (errors.length > 0) {
    throw new Error('订单数据校验失败: ' + errors.join(', '));
  }

  const orderId = generateId();
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO rental_orders (
      id, order_no, venue_id, venue_name, customer_name, customer_phone,
      deposit_amount, rental_start_time, rental_end_time, status,
      created_by, created_at, updated_at, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    orderId,
    orderNo,
    data.venue_id,
    data.venue_name,
    data.customer_name,
    data.customer_phone || null,
    data.deposit_amount,
    data.rental_start_time,
    data.rental_end_time,
    ORDER_STATUS.PENDING,
    operator,
    now,
    now,
    data.remark || null
  );

  logAudit('CREATE', MODULES.ORDER, operator, {
    targetId: orderId,
    targetType: 'rental_order',
    newValues: {
      order_no: orderNo,
      ...data
    }
  });

  return getOrderById(orderId);
}

function getOrderById(orderId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM rental_orders WHERE id = ?
  `).get(orderId);
}

function getOrderByNo(orderNo) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM rental_orders WHERE order_no = ?
  `).get(orderNo);
}

function getOrders(filters = {}) {
  const db = getDatabase();
  let sql = `SELECT * FROM rental_orders WHERE 1=1`;
  const params = [];

  if (filters.venue_id) {
    sql += ` AND venue_id = ?`;
    params.push(filters.venue_id);
  }
  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  if (filters.customer_name) {
    sql += ` AND customer_name LIKE ?`;
    params.push(`%${filters.customer_name}%`);
  }
  if (filters.order_no) {
    sql += ` AND order_no LIKE ?`;
    params.push(`%${filters.order_no}%`);
  }
  if (filters.start_date) {
    sql += ` AND rental_start_time >= ?`;
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    sql += ` AND rental_end_time <= ?`;
    params.push(filters.end_date);
  }

  sql += ` ORDER BY created_at DESC`;

  if (filters.limit) {
    sql += ` LIMIT ?`;
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params);
}

function updateOrderStatus(orderId, newStatus, operator, reason = null) {
  const db = getDatabase();
  const order = getOrderById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  const allowedTransitions = ORDER_STATUS_FLOW[order.status] || [];
  if (newStatus !== order.status && !allowedTransitions.includes(newStatus)) {
    throw new Error(`不允许从 ${order.status} 转换到 ${newStatus}`);
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE rental_orders 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, now, orderId);

    const logId = generateId();
    db.prepare(`
      INSERT INTO order_status_logs (
        id, order_id, from_status, to_status, changed_by, changed_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(logId, orderId, order.status, newStatus, operator, now, reason);
  });

  transaction();

  logAudit('UPDATE_STATUS', MODULES.ORDER, operator, {
    targetId: orderId,
    targetType: 'rental_order',
    oldValues: { status: order.status },
    newValues: { status: newStatus },
    remark: reason
  });

  return getOrderById(orderId);
}

function startUsing(orderId, operator) {
  return updateOrderStatus(orderId, ORDER_STATUS.IN_USE, operator, '开始使用场馆');
}

function startChecking(orderId, operator) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const order = getOrderById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  db.prepare(`
    UPDATE rental_orders 
    SET actual_end_time = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, orderId);

  return updateOrderStatus(orderId, ORDER_STATUS.CHECKING, operator, '开始验收');
}

function cancelOrder(orderId, operator, reason) {
  if (!reason) {
    throw new Error('取消订单必须提供原因');
  }
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED, operator, reason);
}

function updateOrder(orderId, data, operator) {
  const db = getDatabase();
  const order = getOrderById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  const allowedUpdates = ['customer_name', 'customer_phone', 'remark'];
  const updateFields = [];
  const updateValues = [];
  const oldValues = {};
  const newValues = {};

  for (const key of allowedUpdates) {
    if (data[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      updateValues.push(data[key]);
      oldValues[key] = order[key];
      newValues[key] = data[key];
    }
  }

  if (updateFields.length === 0) {
    return order;
  }

  updateValues.push(new Date().toISOString(), orderId);

  db.prepare(`
    UPDATE rental_orders 
    SET ${updateFields.join(', ')}, updated_at = ?
    WHERE id = ?
  `).run(...updateValues);

  logAudit('UPDATE', MODULES.ORDER, operator, {
    targetId: orderId,
    targetType: 'rental_order',
    oldValues,
    newValues
  });

  return getOrderById(orderId);
}

function getOrderWithDetails(orderId) {
  const order = getOrderById(orderId);
  if (!order) return null;

  const db = getDatabase();

  const statusLogs = db.prepare(`
    SELECT * FROM order_status_logs 
    WHERE order_id = ? 
    ORDER BY changed_at ASC
  `).all(orderId);

  const checklists = db.prepare(`
    SELECT * FROM checklists 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  const damageCharges = db.prepare(`
    SELECT * FROM damage_charges 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);

  const utilityRecords = db.prepare(`
    SELECT ur.*, 
           (SELECT JSON_GROUP_ARRAY(JSON_OBJECT(
             'id', ua.id,
             'order_id', ua.order_id,
             'allocation_ratio', ua.allocation_ratio,
             'allocated_amount', ua.allocated_amount,
             'allocation_rule', ua.allocation_rule
           )) FROM utility_allocations ua WHERE ua.utility_record_id = ur.id) as allocations
    FROM utility_records ur 
    WHERE ur.order_id = ? 
    ORDER BY ur.created_at ASC
  `).all(orderId);

  const feeSummary = db.prepare(`
    SELECT * FROM order_fee_summaries 
    WHERE order_id = ?
  `).get(orderId);

  const refundQueue = db.prepare(`
    SELECT * FROM refund_queue 
    WHERE order_id = ?
  `).get(orderId);

  const refundRecords = db.prepare(`
    SELECT * FROM refund_records 
    WHERE order_id = ? 
    ORDER BY operated_at ASC
  `).all(orderId);

  const manualAdjustments = db.prepare(`
    SELECT * FROM manual_adjustments 
    WHERE order_id = ? 
    ORDER BY adjusted_at ASC
  `).all(orderId);

  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE target_id = ? AND target_type = 'rental_order'
    ORDER BY operated_at ASC
  `).all(orderId);

  return {
    order,
    statusLogs,
    checklists,
    damageCharges,
    utilityRecords: utilityRecords.map(r => ({
      ...r,
      allocations: r.allocations ? JSON.parse(r.allocations) : []
    })),
    feeSummary,
    refundQueue,
    refundRecords,
    manualAdjustments,
    auditLogs
  };
}

module.exports = {
  validateOrderData,
  createOrder,
  getOrderById,
  getOrderByNo,
  getOrders,
  updateOrderStatus,
  startUsing,
  startChecking,
  cancelOrder,
  updateOrder,
  getOrderWithDetails
};
