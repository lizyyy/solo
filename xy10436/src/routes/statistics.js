const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/stream/:stream_id', (req, res) => {
  const { stream_id } = req.params;
  
  const stream = db.prepare('SELECT * FROM streams WHERE id = ?').get(stream_id);
  if (!stream) return res.status(404).json({ error: '直播场次不存在' });

  const orders = db.prepare(`
    SELECT * FROM orders WHERE stream_id = ?
  `).all(stream_id);

  const orderCount = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalPayAmount = orders.reduce((sum, o) => sum + o.pay_amount, 0);
  const totalDiscount = orders.reduce((sum, o) => sum + o.discount_amount, 0);

  const promotionStats = db.prepare(`
    SELECT 
      op.promotion_type,
      op.promotion_id,
      SUM(op.discount_amount) as total_discount,
      COUNT(*) as usage_count
    FROM order_promotions op
    JOIN orders o ON op.order_id = o.id
    WHERE o.stream_id = ?
    GROUP BY op.promotion_type, op.promotion_id
  `).all(stream_id);

  const giftStats = db.prepare(`
    SELECT 
      og.gift_rule_id,
      g.name as gift_name,
      SUM(og.gift_quantity) as total_quantity,
      COUNT(*) as order_count
    FROM order_gifts og
    JOIN orders o ON og.order_id = o.id
    JOIN gifts g ON og.gift_rule_id = g.id
    WHERE o.stream_id = ?
    GROUP BY og.gift_rule_id
  `).all(stream_id);

  const partialRefundOrders = orders.filter(o => o.status === 'partially_refunded');
  const fullRefundOrders = orders.filter(o => o.status === 'refunded');

  const refundStats = db.prepare(`
    SELECT 
      SUM(oi.refund_amount) as total_refund_amount,
      SUM(oi.refund_quantity) as total_refund_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.stream_id = ?
  `).get(stream_id);

  const abnormalOrders = [
    ...partialRefundOrders.map(o => ({ ...o, abnormal_type: 'partial_refund' })),
    ...fullRefundOrders.map(o => ({ ...o, abnormal_type: 'full_refund' }))
  ];

  res.json({
    stream_id: Number(stream_id),
    stream_name: stream.streamer_name + ' 的直播',
    summary: {
      order_count: orderCount,
      total_amount: Math.floor(totalAmount * 100) / 100,
      pay_amount: Math.floor(totalPayAmount * 100) / 100,
      discount_cost: Math.floor(totalDiscount * 100) / 100,
      refund_amount: refundStats.total_refund_amount || 0,
      net_revenue: Math.floor((totalPayAmount - (refundStats.total_refund_amount || 0)) * 100) / 100
    },
    promotion_usage: promotionStats,
    gift_consumption: giftStats,
    abnormal_orders: {
      count: abnormalOrders.length,
      partial_refund_count: partialRefundOrders.length,
      full_refund_count: fullRefundOrders.length,
      details: abnormalOrders.map(o => ({
        order_no: o.order_no,
        status: o.status,
        total_amount: o.total_amount,
        pay_amount: o.pay_amount,
        discount_amount: o.discount_amount
      }))
    }
  });
});

module.exports = router;
