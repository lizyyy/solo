const express = require('express');
const router = express.Router();
const compensationService = require('../services/compensationService');
const db = require('../database');

router.post('/', async (req, res) => {
  try {
    const { order_id, order_item_id, type, amount, reason, operator } = req.body;

    if (!order_id || !type || !reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!['refund', 'exchange', 'coupon'].includes(type)) {
      return res.status(400).json({ error: '无效的补偿类型' });
    }

    const result = await compensationService.createCompensation(order_id, type, {
      orderItemId: order_item_id,
      amount,
      reason,
      operator
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { order_ids, type, amount, reason, operator } = req.body;

    if (!order_ids || !order_ids.length || !type || !reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (!['refund', 'exchange', 'coupon'].includes(type)) {
      return res.status(400).json({ error: '无效的补偿类型' });
    }

    const result = await compensationService.batchCompensate(order_ids, type, {
      amount,
      reason,
      operator
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const result = await compensationService.confirmCompensation(req.params.id, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/rollback', async (req, res) => {
  try {
    const { reason, operator } = req.body;
    if (!reason) {
      return res.status(400).json({ error: '请提供回滚原因' });
    }

    const result = await compensationService.rollbackCompensation(req.params.id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM compensations WHERE 1=1';
    const params = [];

    if (req.query.order_id) {
      sql += ' AND order_id = ?';
      params.push(req.query.order_id);
    }

    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    if (req.query.type) {
      sql += ' AND type = ?';
      params.push(req.query.type);
    }

    sql += ' ORDER BY created_at DESC';

    const compensations = await db.all(sql, params);
    res.json(compensations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const compensation = await db.get('SELECT * FROM compensations WHERE id = ?', [req.params.id]);
    if (!compensation) {
      return res.status(404).json({ error: '补偿记录不存在' });
    }
    res.json(compensation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
