const db = require('../db');
const { calculateOrder } = require('./calculator');

const generateOrderNo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `LS${year}${month}${day}${random}`;
};

const checkStreamActive = (streamId) => {
  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(streamId);
  if (!stream) return { active: false, reason: '直播场次不存在' };
  if (stream.status !== 'active') return { active: false, reason: '直播已结束' };
  if (stream.end_time && new Date(stream.end_time) < new Date()) {
    return { active: false, reason: '主播场次已结束，无法下单' };
  }
  return { active: true };
};

const previewOrder = (items, streamId, platformCouponId, anchorCouponId, userId) => {
  const streamCheck = checkStreamActive(streamId);
  if (!streamCheck.active) {
    return { error: streamCheck.reason };
  }
  return calculateOrder(items, streamId, platformCouponId, anchorCouponId, userId);
};

const createOrder = (items, streamId, platformCouponId, anchorCouponId, userId) => {
  const streamCheck = checkStreamActive(streamId);
  if (!streamCheck.active) {
    return { error: streamCheck.reason };
  }

  const tx = db.transaction(() => {
    const calculation = calculateOrder(items, streamId, platformCouponId, anchorCouponId, userId);
    if (calculation.error) {
      throw new Error(JSON.stringify(calculation));
    }

    const orderNo = generateOrderNo();
    const orderStmt = db.prepare(`
      INSERT INTO orders (order_no, stream_id, user_id, total_amount, discount_amount, pay_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'paid')
    `);
    const orderResult = orderStmt.run(
      orderNo,
      streamId,
      userId,
      calculation.total_amount,
      calculation.discount_amount,
      calculation.pay_amount
    );
    const orderId = orderResult.lastInsertRowid;

    const orderItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, discount_amount, pay_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const productUpdateStmt = db.prepare(`
      UPDATE products SET stock = stock - ? WHERE id = ?
    `);

    for (const item of calculation.items) {
      orderItemStmt.run(
        orderId,
        item.product_id,
        item.quantity,
        item.product.price,
        item.total_price,
        item.discount_amount,
        item.pay_amount
      );
      productUpdateStmt.run(item.quantity, item.product_id);
    }

    const promotionStmt = db.prepare(`
      INSERT INTO order_promotions (order_id, promotion_type, promotion_id, discount_amount)
      VALUES (?, ?, ?, ?)
    `);

    const couponUsageStmt = db.prepare(`
      INSERT INTO coupon_usage (coupon_id, order_id, user_id, status)
      VALUES (?, ?, ?, 'used')
    `);

    for (const promotion of calculation.applied_promotions) {
      promotionStmt.run(orderId, promotion.type, promotion.id, promotion.discount_amount);
      
      if (promotion.type === 'coupon_platform' || promotion.type === 'coupon_anchor') {
        couponUsageStmt.run(promotion.id, orderId, userId);
      }
    }

    const giftStmt = db.prepare(`
      INSERT INTO order_gifts (order_id, gift_rule_id, gift_product_id, gift_quantity)
      VALUES (?, ?, ?, ?)
    `);

    const giftUpdateStmt = db.prepare(`
      UPDATE gifts SET stock = stock - ? WHERE id = ?
    `);

    for (const gift of calculation.gifts) {
      giftStmt.run(orderId, gift.gift_rule_id, gift.gift_product_id, gift.gift_quantity);
      giftUpdateStmt.run(gift.gift_quantity, gift.gift_rule_id);
    }

    return {
      order_id: orderId,
      order_no: orderNo,
      ...calculation
    };
  });

  try {
    return tx();
  } catch (error) {
    if (error.message.includes('{"error":')) {
      return JSON.parse(error.message);
    }
    throw error;
  }
};

const partialRefund = (orderNo, refundItems) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  if (!order) return { error: '订单不存在' };
  if (order.status === 'refunded') return { error: '订单已全额退款' };

  const tx = db.transaction(() => {
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const itemsMap = new Map(orderItems.map(i => [i.product_id, i]));

    let totalRefundAmount = 0;
    let totalRefundQuantity = 0;

    const orderItemUpdateStmt = db.prepare(`
      UPDATE order_items 
      SET refund_quantity = refund_quantity + ?, refund_amount = refund_amount + ?
      WHERE order_id = ? AND product_id = ?
    `);

    const productRestoreStmt = db.prepare(`
      UPDATE products SET stock = stock + ? WHERE id = ?
    `);

    for (const refundItem of refundItems) {
      const orderItem = itemsMap.get(refundItem.product_id);
      if (!orderItem) continue;

      const availableQuantity = orderItem.quantity - orderItem.refund_quantity;
      const refundQty = Math.min(refundItem.quantity, availableQuantity);
      if (refundQty <= 0) continue;

      const refundAmt = orderItem.pay_amount / orderItem.quantity * refundQty;
      totalRefundAmount += refundAmt;
      totalRefundQuantity += refundQty;

      orderItemUpdateStmt.run(refundQty, refundAmt, order.id, refundItem.product_id);
      productRestoreStmt.run(refundQty, refundItem.product_id);
    }

    const updatedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const allRefunded = updatedItems.every(i => i.refund_quantity >= i.quantity);

    if (allRefunded) {
      db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(order.id);
      
      const promotions = db.prepare('SELECT * FROM order_promotions WHERE order_id = ? AND is_refunded = 0').all(order.id);
      for (const promo of promotions) {
        db.prepare(`
          UPDATE order_promotions 
          SET is_refunded = 1, refund_time = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(promo.id);

        if (promo.promotion_type === 'coupon_platform' || promo.promotion_type === 'coupon_anchor') {
          db.prepare("UPDATE coupon_usage SET status = 'refunded' WHERE order_id = ? AND coupon_id = ?").run(order.id, promo.promotion_id);
        }
      }

      const gifts = db.prepare('SELECT * FROM order_gifts WHERE order_id = ? AND is_refunded = 0').all(order.id);
      for (const gift of gifts) {
        db.prepare('UPDATE order_gifts SET is_refunded = 1 WHERE id = ?').run(gift.id);
        db.prepare('UPDATE gifts SET stock = stock + ? WHERE id = ?').run(gift.gift_quantity, gift.gift_rule_id);
      }
    } else if (totalRefundQuantity > 0) {
      db.prepare("UPDATE orders SET status = 'partially_refunded' WHERE id = ?").run(order.id);
    }

    return {
      order_no: orderNo,
      refund_amount: Math.floor(totalRefundAmount * 100) / 100,
      refund_quantity: totalRefundQuantity,
      new_status: allRefunded ? 'refunded' : (totalRefundQuantity > 0 ? 'partially_refunded' : order.status)
    };
  });

  return tx();
};

const fullRefund = (orderNo) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  if (!order) return { error: '订单不存在' };
  if (order.status === 'refunded') return { error: '订单已全额退款' };

  const tx = db.transaction(() => {
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    
    let totalRefundAmount = 0;
    const productRestoreStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    
    for (const item of orderItems) {
      const remainingQty = item.quantity - item.refund_quantity;
      if (remainingQty > 0) {
        const itemRefundAmt = item.pay_amount - item.refund_amount;
        totalRefundAmount += itemRefundAmt;
        db.prepare(`
          UPDATE order_items 
          SET refund_quantity = ?, refund_amount = ?
          WHERE id = ?
        `).run(item.quantity, item.pay_amount, item.id);
        productRestoreStmt.run(remainingQty, item.product_id);
      }
    }

    db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(order.id);

    const promotions = db.prepare('SELECT * FROM order_promotions WHERE order_id = ? AND is_refunded = 0').all(order.id);
    for (const promo of promotions) {
      db.prepare(`
        UPDATE order_promotions 
        SET is_refunded = 1, refund_time = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(promo.id);

      if (promo.promotion_type === 'coupon_platform' || promo.promotion_type === 'coupon_anchor') {
        db.prepare("UPDATE coupon_usage SET status = 'refunded' WHERE order_id = ? AND coupon_id = ?").run(order.id, promo.promotion_id);
      }
    }

    const gifts = db.prepare('SELECT * FROM order_gifts WHERE order_id = ? AND is_refunded = 0').all(order.id);
    for (const gift of gifts) {
      db.prepare('UPDATE order_gifts SET is_refunded = 1 WHERE id = ?').run(gift.id);
      db.prepare('UPDATE gifts SET stock = stock + ? WHERE id = ?').run(gift.gift_quantity, gift.gift_rule_id);
    }

    return {
      order_no: orderNo,
      refund_amount: Math.floor(totalRefundAmount * 100) / 100,
      new_status: 'refunded'
    };
  });

  return tx();
};

const getOrderDetail = (orderNo) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  if (!order) return { error: '订单不存在' };

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(order.id);

  const promotions = db.prepare('SELECT * FROM order_promotions WHERE order_id = ?').all(order.id);
  const gifts = db.prepare(`
    SELECT og.*, p.name as gift_name
    FROM order_gifts og
    JOIN products p ON og.gift_product_id = p.id
    WHERE og.order_id = ?
  `).all(order.id);

  return {
    ...order,
    items,
    promotions,
    gifts
  };
};

module.exports = {
  previewOrder,
  createOrder,
  partialRefund,
  fullRefund,
  getOrderDetail,
  checkStreamActive
};
