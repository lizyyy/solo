const db = require('../config/database');
const historyService = require('./history');
const { v4: uuidv4 } = require('uuid');

const ORDER_STATUS = {
  PENDING: 'pending',
  WAVE_ASSIGNED: 'wave_assigned',
  PICKING: 'picking',
  PARTIAL_PICKED: 'partial_picked',
  SPLIT: 'split',
  SHIPPED: 'shipped',
  PARTIAL_SHIPPED: 'partial_shipped',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const LINE_STATUS = {
  PENDING: 'pending',
  PICKING: 'picking',
  PICKED: 'picked',
  SHIPPED: 'shipped',
  STOCKOUT: 'stockout',
  TRANSFERING: 'transfering',
  TRANSFER_FAILED: 'transfer_failed',
  RETAINED: 'retained',
  CANCELLED: 'cancelled'
};

function createOrder(orderData) {
  const orderId = `ord_${uuidv4()}`;
  const orderNo = orderData.order_no || `SO${Date.now()}`;

  const transaction = db.transaction((data) => {
    db.prepare(`
      INSERT INTO orders (id, order_no, customer_name, customer_phone, province, city, address, total_amount, shipping_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      orderNo,
      data.customer_name,
      data.customer_phone,
      data.province,
      data.city,
      data.address,
      0,
      data.shipping_fee || 0,
      ORDER_STATUS.PENDING
    );

    let totalAmount = 0;
    for (const line of data.lines) {
      const sku = db.prepare('SELECT * FROM skus WHERE code = ?').get(line.sku_code);
      if (!sku) {
        throw new Error(`SKU ${line.sku_code} 不存在`);
      }

      const amount = line.qty * line.price;
      totalAmount += amount;

      db.prepare(`
        INSERT INTO order_lines (id, order_id, sku_id, sku_code, sku_name, qty, price, amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `line_${uuidv4()}`,
        orderId,
        sku.id,
        sku.code,
        sku.name,
        line.qty,
        line.price,
        amount,
        LINE_STATUS.PENDING
      );
    }

    db.prepare('UPDATE orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalAmount, orderId);

    historyService.addStatusHistory('order', orderId, null, ORDER_STATUS.PENDING, data.operator || 'system', '订单创建');
  });

  transaction(orderData);
  return getOrderById(orderId);
}

function getOrderById(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const lines = db.prepare('SELECT * FROM order_lines WHERE order_id = ?').all(orderId);
  const history = historyService.getStatusHistory('order', orderId);
  const corrections = historyService.getManualCorrections('order', orderId);
  const childOrders = db.prepare('SELECT * FROM orders WHERE parent_order_id = ?').all(orderId);

  return {
    ...order,
    lines,
    history,
    manual_corrections: corrections,
    child_orders: childOrders
  };
}

function getOrderByNo(orderNo) {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  return order ? getOrderById(order.id) : null;
}

function updateOrderStatus(orderId, newStatus, operator, remark) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('订单不存在');

  if (order.status === newStatus) return order;

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, orderId);

  historyService.addStatusHistory('order', orderId, order.status, newStatus, operator, remark);

  return getOrderById(orderId);
}

function updateLineStatus(lineId, newStatus, operator, remark) {
  const line = db.prepare('SELECT * FROM order_lines WHERE id = ?').get(lineId);
  if (!line) throw new Error('订单行不存在');

  if (line.status === newStatus) return line;

  db.prepare('UPDATE order_lines SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, lineId);

  historyService.addStatusHistory('order_line', lineId, line.status, newStatus, operator, remark);

  return db.prepare('SELECT * FROM order_lines WHERE id = ?').get(lineId);
}

function listOrders(filters = {}) {
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.order_no) {
    query += ' AND order_no LIKE ?';
    params.push(`%${filters.order_no}%`);
  }

  query += ' ORDER BY created_at DESC';

  return db.prepare(query).all(...params);
}

function correctOrderStatus(orderId, oldStatus, newStatus, reason, operator) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('订单不存在');

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, orderId);

  historyService.addManualCorrection(
    'order',
    orderId,
    'status',
    oldStatus,
    newStatus,
    reason,
    operator
  );

  historyService.addStatusHistory('order', orderId, order.status, newStatus, operator, `人工修正: ${reason}`);

  return getOrderById(orderId);
}

module.exports = {
  ORDER_STATUS,
  LINE_STATUS,
  createOrder,
  getOrderById,
  getOrderByNo,
  updateOrderStatus,
  updateLineStatus,
  listOrders,
  correctOrderStatus
};
