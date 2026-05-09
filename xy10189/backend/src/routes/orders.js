const express = require('express');
const router = express.Router();
const getDB = require('../config/database');
const creditService = require('../services/creditService');

router.post('/', async (req, res) => {
  const { customer_id, order_no, amount, remark, operator } = req.body;
  
  if (!customer_id || !order_no || !amount) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  const result = await creditService.createOrder(customer_id, order_no, amount, remark, operator);
  res.json(result);
});

router.get('/', async (req, res) => {
  const db = getDB();
  const { customer_id, order_status } = req.query;
  
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND customer_id = ?';
    params.push(customer_id);
  }
  if (order_status) {
    query += ' AND order_status = ?';
    params.push(order_status);
  }

  query += ' ORDER BY created_at DESC';

  const orders = await db.prepare(query).all(...params);
  res.json({
    success: true,
    data: orders,
    total: orders.length
  });
});

router.get('/:id', async (req, res) => {
  const db = getDB();
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.json({ success: false, message: '订单不存在' });
  }

  const returns = await db.prepare('SELECT * FROM returns WHERE order_id = ?').all(req.params.id);
  
  res.json({
    success: true,
    data: {
      order,
      returns
    }
  });
});

module.exports = router;
