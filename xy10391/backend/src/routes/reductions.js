const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const FeeService = require('../services/feeService');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, year, status } = req.query;
    
    let query = `
      SELECT rr.*, m.member_code, m.company_name, ml.level_name,
             u1.real_name as creator_name, u2.real_name as approver_name
      FROM reduction_requests rr
      LEFT JOIN members m ON rr.member_id = m.id
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      LEFT JOIN users u1 ON rr.created_by = u1.id
      LEFT JOIN users u2 ON rr.approved_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (memberId) {
      query += ' AND rr.member_id = ?';
      params.push(memberId);
    }

    if (year) {
      query += ' AND rr.fee_year = ?';
      params.push(year);
    }

    if (status) {
      query += ' AND rr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY rr.created_at DESC';

    const requests = db.prepare(query).all(...params);
    
    res.json({
      total: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('获取减免申请列表失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/', authenticateToken, [
  body('memberId').notEmpty().withMessage('会员不能为空'),
  body('feeYear').notEmpty().withMessage('减免年度不能为空'),
  body('requestType').notEmpty().withMessage('减免类型不能为空'),
  body('requestValue').notEmpty().withMessage('减免值不能为空'),
  body('reason').notEmpty().withMessage('减免原因不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { memberId, feeYear, requestType, requestValue, reason } = req.body;

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }

    if (member.status === 'resigned') {
      return res.status(400).json({ error: '该会员已退会，无法申请减免' });
    }

    const rule = db.prepare(`
      SELECT fee_amount FROM fee_rules
      WHERE member_level_id = ? AND effective_year = ?
      LIMIT 1
    `).get(member.member_level_id, feeYear);

    if (!rule) {
      return res.status(400).json({ error: `未找到${feeYear}年度的会费规则` });
    }

    const originalAmount = parseFloat(rule.fee_amount);

    const countResult = db.prepare('SELECT COUNT(*) as count FROM reduction_requests').get();
    const requestCode = `REQ${String(countResult.count + 1).padStart(3, '0')}`;

    const result = db.prepare(`
      INSERT INTO reduction_requests
      (request_code, member_id, fee_year, original_amount, request_type, request_value, reason, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(requestCode, memberId, feeYear, originalAmount, requestType, requestValue, reason, req.user.id);

    res.json({
      id: result.lastInsertRowid,
      requestCode,
      message: '减免申请创建成功'
    });
  } catch (error) {
    console.error('创建减免申请失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const request = db.prepare(`
      SELECT rr.*, m.member_code, m.company_name, m.contact_person, m.contact_phone,
             ml.level_name, u1.real_name as creator_name, u2.real_name as approver_name
      FROM reduction_requests rr
      LEFT JOIN members m ON rr.member_id = m.id
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      LEFT JOIN users u1 ON rr.created_by = u1.id
      LEFT JOIN users u2 ON rr.approved_by = u2.id
      WHERE rr.id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({ error: '减免申请不存在' });
    }

    res.json(request);
  } catch (error) {
    console.error('获取减免申请详情失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/:id/approve', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { approvalComment } = req.body;
    const result = await FeeService.handleReductionRequest(
      req.params.id,
      'approved',
      req.user.id,
      approvalComment
    );
    res.json(result);
  } catch (error) {
    console.error('批准减免申请失败:', error);
    res.status(400).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/:id/reject', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { approvalComment } = req.body;
    const result = await FeeService.handleReductionRequest(
      req.params.id,
      'rejected',
      req.user.id,
      approvalComment
    );
    res.json(result);
  } catch (error) {
    console.error('拒绝减免申请失败:', error);
    res.status(400).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const request = db.prepare(
      'SELECT * FROM reduction_requests WHERE id = ?'
    ).get(req.params.id);

    if (!request) {
      return res.status(404).json({ error: '减免申请不存在' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: '只能取消待审批的申请' });
    }

    db.prepare(`
      UPDATE reduction_requests SET status = 'cancelled' WHERE id = ?
    `).run(req.params.id);

    res.json({ message: '减免申请已取消' });
  } catch (error) {
    console.error('取消减免申请失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

module.exports = router;
