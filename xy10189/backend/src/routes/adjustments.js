const express = require('express');
const router = express.Router();
const getDB = require('../config/database');
const creditService = require('../services/creditService');

router.post('/', async (req, res) => {
  const { customer_id, adjustment_type, amount, reason, requester } = req.body;
  
  if (!customer_id || !adjustment_type || !amount || !reason || !requester) {
    return res.json({ success: false, message: '缺少必要参数' });
  }

  const result = await creditService.submitCreditAdjustment(customer_id, adjustment_type, amount, reason, requester);
  res.json(result);
});

router.post('/:id/approve', async (req, res) => {
  const { approver, approval_remark } = req.body;
  
  if (!approver) {
    return res.json({ success: false, message: '缺少审批人信息' });
  }

  const result = await creditService.approveCreditAdjustment(req.params.id, approver, approval_remark, true);
  res.json(result);
});

router.post('/:id/reject', async (req, res) => {
  const { approver, approval_remark } = req.body;
  
  if (!approver) {
    return res.json({ success: false, message: '缺少审批人信息' });
  }

  const result = await creditService.approveCreditAdjustment(req.params.id, approver, approval_remark, false);
  res.json(result);
});

router.get('/', async (req, res) => {
  const db = getDB();
  const { customer_id, approval_status } = req.query;
  
  let query = 'SELECT * FROM credit_adjustments WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND customer_id = ?';
    params.push(customer_id);
  }
  if (approval_status) {
    query += ' AND approval_status = ?';
    params.push(approval_status);
  }

  query += ' ORDER BY created_at DESC';

  const adjustments = await db.prepare(query).all(...params);
  res.json({
    success: true,
    data: adjustments,
    total: adjustments.length
  });
});

router.get('/:id', async (req, res) => {
  const db = getDB();
  const adjustment = await db.prepare('SELECT * FROM credit_adjustments WHERE id = ?').get(req.params.id);
  if (!adjustment) {
    return res.json({ success: false, message: '调额申请不存在' });
  }

  res.json({
    success: true,
    data: adjustment
  });
});

module.exports = router;
