const { v4: uuidv4 } = require('uuid');
const { getDb, transaction } = require('../db');
const { getTier, getAvailable, deductInventory, restoreInventory } = require('./inventory');
const { checkLimits } = require('./limit');
const { checkRisk } = require('./risk');
const { addToQueue, processQueueForRelease, removeFromQueue, getQueueStatus } = require('./queue');
const { createInventoryRestoreTask, createOrderStatusTask, runCompensation } = require('./compensation');

function generateTicketNo() {
  const prefix = 'TK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function createOrder(params) {
  const { tierId, accountId, idCardNo, paymentChannel, quantity, ip, holders = [] } = params;
  const db = getDb();

  const riskCheck = checkRisk({ accountId, idCardNo, paymentChannel, ip, quantity });
  if (!riskCheck.pass) {
    return {
      success: false,
      reason: riskCheck.reason,
      code: riskCheck.code,
      action: '风控拦截'
    };
  }

  const tier = getTier(tierId);
  if (!tier) {
    return { success: false, reason: '票档不存在', code: 'TIER_NOT_FOUND' };
  }

  const limitCheck = checkLimits(tierId, accountId, idCardNo, paymentChannel, quantity);
  if (!limitCheck.pass) {
    return {
      success: false,
      reason: limitCheck.reason,
      code: limitCheck.code,
      action: '限购拦截'
    };
  }

  const avail = getAvailable(tierId);
  if (avail.available < quantity) {
    const queueResult = addToQueue(tierId, accountId, idCardNo, paymentChannel, quantity);
    return {
      success: false,
      reason: `库存不足，当前可售 ${avail.available} 张`,
      code: 'OUT_OF_STOCK',
      action: '已加入候补队列',
      queue: queueResult
    };
  }

  return transaction(() => {
    try {
      deductInventory(tierId, quantity);

      const orderId = uuidv4();
      const totalAmount = tier.price * quantity;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO orders (
          id, show_id, tier_id, account_id, id_card_no,
          payment_channel, quantity, total_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        orderId, tier.show_id, tierId, accountId, idCardNo,
        paymentChannel, quantity, totalAmount, now
      );

      for (let i = 0; i < quantity; i++) {
        const ticketId = uuidv4();
        const ticketNo = generateTicketNo();
        const holder = holders[i] || {};

        db.prepare(`
          INSERT INTO order_tickets (
            id, order_id, ticket_no, holder_name, holder_id_card, status
          ) VALUES (?, ?, ?, ?, ?, 'valid')
        `).run(ticketId, orderId, ticketNo, holder.name || null, holder.idCard || null);
      }

      return {
        success: true,
        code: 'ORDER_CREATED',
        order: {
          id: orderId,
          status: 'pending_payment',
          showName: tier.show_name,
          tierName: tier.name,
          quantity,
          totalAmount: `¥${(totalAmount / 100).toFixed(2)}`,
          message: '订单已创建，请在 15 分钟内完成支付'
        }
      };
    } catch (error) {
      createInventoryRestoreTask(tierId, quantity, uuidv4());
      return {
        success: false,
        reason: `下单失败: ${error.message}`,
        code: 'ORDER_CREATE_FAILED',
        action: '已创建补偿任务，库存将自动回补'
      };
    }
  });
}

function payOrder(orderId) {
  const db = getDb();

  const order = db.prepare(`
    SELECT o.*, t.name as tier_name, s.name as show_name
    FROM orders o
    JOIN ticket_tiers t ON o.tier_id = t.id
    JOIN shows s ON o.show_id = s.id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) {
    return { success: false, reason: '订单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'pending') {
    return { success: false, reason: `订单当前状态为「${order.status}」，无法支付`, code: 'INVALID_STATUS' };
  }

  const riskCheck = checkRisk({
    accountId: order.account_id,
    idCardNo: order.id_card_no,
    paymentChannel: order.payment_channel,
    ip: null,
    quantity: order.quantity
  });

  if (!riskCheck.pass) {
    createInventoryRestoreTask(order.tier_id, order.quantity, orderId);
    db.prepare(`
      UPDATE orders SET status = 'failed', fail_reason = ?, cancelled_at = ? WHERE id = ?
    `).run(riskCheck.reason, new Date().toISOString(), orderId);
    
    return {
      success: false,
      reason: riskCheck.reason,
      code: riskCheck.code,
      action: '支付被风控拦截，已自动退票回补库存'
    };
  }

  db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?
  `).run(new Date().toISOString(), orderId);

  const tickets = db.prepare(`
    SELECT ticket_no, holder_name, holder_id_card FROM order_tickets WHERE order_id = ?
  `).all(orderId);

  return {
    success: true,
    code: 'PAYMENT_SUCCESS',
    order: {
      id: orderId,
      status: 'paid',
      showName: order.show_name,
      tierName: order.tier_name,
      quantity: order.quantity,
      totalAmount: `¥${(order.total_amount / 100).toFixed(2)}`,
      tickets: tickets.map(t => ({
        ticketNo: t.ticket_no,
        holderName: t.holder_name || '未填写'
      }))
    },
    message: '支付成功，电子票已发送至您的账户'
  };
}

function refundOrder(orderId, reason = '用户申请退票') {
  const db = getDb();

  const order = db.prepare(`
    SELECT o.*, t.name as tier_name, s.name as show_name
    FROM orders o
    JOIN ticket_tiers t ON o.tier_id = t.id
    JOIN shows s ON o.show_id = s.id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) {
    return { success: false, reason: '订单不存在', code: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'paid') {
    return { success: false, reason: `订单当前状态为「${order.status}」，仅已支付订单可退票`, code: 'INVALID_STATUS' };
  }

  return transaction(() => {
    try {
      db.prepare(`
        UPDATE orders SET status = 'refunded', fail_reason = ?, cancelled_at = ? WHERE id = ?
      `).run(reason, new Date().toISOString(), orderId);

      db.prepare(`
        UPDATE order_tickets SET status = 'refunded' WHERE order_id = ?
      `).run(orderId);

      restoreInventory(order.tier_id, order.quantity);

      const queueResult = processQueueForRelease(order.tier_id, order.quantity);

      return {
        success: true,
        code: 'REFUND_SUCCESS',
        order: {
          id: orderId,
          status: 'refunded',
          showName: order.show_name,
          tierName: order.tier_name,
          refundAmount: `¥${(order.total_amount / 100).toFixed(2)}`
        },
        queueAction: queueResult.matched.length > 0
          ? `退票释放的 ${order.quantity} 张票已匹配给候补队列的 ${queueResult.matched.length} 位用户`
          : `退票释放的 ${order.quantity} 张票已回补库存，暂无候补用户匹配`,
        matchedUsers: queueResult.matched
      };
    } catch (error) {
      createInventoryRestoreTask(order.tier_id, order.quantity, orderId);
      createOrderStatusTask(orderId, 'refunded', reason);
      return {
        success: false,
        reason: `退票过程中出现问题: ${error.message}`,
        code: 'REFUND_PARTIAL',
        action: '已创建补偿任务，将自动重试处理'
      };
    }
  });
}

function getOrder(orderId) {
  const db = getDb();
  
  const order = db.prepare(`
    SELECT o.*, t.name as tier_name, s.name as show_name, t.price as unit_price
    FROM orders o
    JOIN ticket_tiers t ON o.tier_id = t.id
    JOIN shows s ON o.show_id = s.id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) return null;

  const tickets = db.prepare(`
    SELECT * FROM order_tickets WHERE order_id = ?
  `).all(orderId);

  return {
    ...order,
    tickets,
    totalAmountDisplay: `¥${(order.total_amount / 100).toFixed(2)}`,
    unitPriceDisplay: `¥${(order.unit_price / 100).toFixed(2)}`
  };
}

function listOrders(accountId = null) {
  const db = getDb();
  
  let sql = `
    SELECT o.*, t.name as tier_name, s.name as show_name
    FROM orders o
    JOIN ticket_tiers t ON o.tier_id = t.id
    JOIN shows s ON o.show_id = s.id
  `;
  const params = [];

  if (accountId) {
    sql += ' WHERE o.account_id = ?';
    params.push(accountId);
  }

  sql += ' ORDER BY o.created_at DESC';

  return db.prepare(sql).all(...params).map(o => ({
    ...o,
    totalAmountDisplay: `¥${(o.total_amount / 100).toFixed(2)}`
  }));
}

module.exports = {
  createOrder,
  payOrder,
  refundOrder,
  getOrder,
  listOrders
};
