const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const FeeService = require('../services/feeService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, year, status } = req.query;
    
    let query = `
      SELECT p.*, m.member_code, m.company_name, ml.level_name, u.real_name as creator_name
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.id
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (memberId) {
      query += ' AND p.member_id = ?';
      params.push(memberId);
    }

    if (year) {
      query += ' AND p.fee_year = ?';
      params.push(year);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const payments = db.prepare(query).all(...params);
    
    res.json({
      total: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('获取缴费记录失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/', authenticateToken, [
  body('memberId').notEmpty().withMessage('会员不能为空'),
  body('feeYear').notEmpty().withMessage('缴费年度不能为空'),
  body('paidAmount').notEmpty().withMessage('缴费金额不能为空').isFloat({ min: 0.01 }).withMessage('缴费金额必须大于0'),
  body('paymentMethod').notEmpty().withMessage('缴费方式不能为空'),
  body('paymentDate').notEmpty().withMessage('缴费日期不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await FeeService.createPayment(req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('创建缴费记录失败:', error);
    res.status(400).json({ error: error.message || '服务器内部错误' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT p.*, m.member_code, m.company_name, ml.level_name, u.real_name as creator_name
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.id
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: '缴费记录不存在' });
    }

    res.json(payment);
  } catch (error) {
    console.error('获取缴费记录详情失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/:id/refund', authenticateToken, async (req, res) => {
  try {
    const { remark } = req.body;

    const payment = db.prepare(
      'SELECT * FROM payments WHERE id = ?'
    ).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: '缴费记录不存在' });
    }

    if (payment.status !== 'paid') {
      return res.status(400).json({ error: '该记录不能退款' });
    }

    const newRemark = remark ? `${remark} [退款处理]` : '[退款处理]';
    db.prepare(`
      UPDATE payments SET status = 'refunded', remark = ?
      WHERE id = ?
    `).run(newRemark, req.params.id);

    res.json({ message: '退款成功' });
  } catch (error) {
    console.error('退款失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

module.exports = router;
