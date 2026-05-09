const express = require('express');
const router = express.Router();
const getDB = require('../config/database');
const creditService = require('../services/creditService');

router.post('/', async (req, res) => {
  const { order_id, return_amount, remark, operator } = req.body;
  
  if (!order_id || !return_amount) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  const result = await creditService.processReturn(order_id, return_amount, remark, operator);
  res.json(result);
});

router.get('/', async (req, res) => {
  const db = getDB();
  const { customer_id, order_id } = req.query;
  
  let query = 'SELECT * FROM returns WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND customer_id = ?';
    params.push(customer_id);
  }
  if (order_id) {
    query += ' AND order_id = ?';
    params.push(order_id);
  }

  query += ' ORDER BY created_at DESC';

  const returns = await db.prepare(query).all(...params);
  res.json({
    success: true,
    data: returns,
    total: returns.length
  });
});

router.get('/:id', async (req, res) => {
  const db = getDB();
  const returnRecord = await db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
  if (!returnRecord) {
    return res.json({ success: false, message: '退货记录不存在' });
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(returnRecord.order_id);
  
  res.json({
    success: true,
    data: {
      return: returnRecord,
      order
    }
  });
});

module.exports = router;
