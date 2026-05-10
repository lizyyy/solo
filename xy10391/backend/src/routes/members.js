const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const FeeService = require('../services/feeService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { keyword, status, level, year } = req.query;
    const feeYear = parseInt(year || new Date().getFullYear());
    
    let query = `
      SELECT m.*, ml.level_name, ml.level_code
      FROM members m
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      query += ' AND (m.company_name LIKE ? OR m.member_code LIKE ? OR m.contact_person LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    if (status) {
      query += ' AND m.status = ?';
      params.push(status);
    }

    if (level) {
      query += ' AND m.member_level_id = ?';
      params.push(level);
    }

    query += ' ORDER BY ml.sort_order, m.join_date';

    const members = db.prepare(query).all(...params);

    const results = [];
    for (const member of members) {
      const feeResult = await FeeService.calculateMemberFee(member.id, feeYear);
      const reminderStatus = await FeeService.getMemberReminderStatus(member);
      
      results.push({
        id: member.id,
        memberCode: member.member_code,
        companyName: member.company_name,
        legalPerson: member.legal_person,
        contactPerson: member.contact_person,
        contactPhone: member.contact_phone,
        address: member.address,
        industry: member.industry,
        memberLevelId: member.member_level_id,
        memberLevelName: member.level_name,
        memberLevelCode: member.level_code,
        isSmallEnterprise: member.is_small_enterprise,
        joinDate: member.join_date,
        expiryDate: member.expiry_date,
        status: member.status,
        note: member.note,
        feeYear,
        originalAmount: feeResult.originalAmount,
        reductionAmount: feeResult.reductionAmount,
        paidAmount: feeResult.paidAmount,
        dueAmount: feeResult.dueAmount,
        isFullyPaid: feeResult.isFullyPaid,
        reminderStatus: reminderStatus.status,
        reminderDescription: reminderStatus.description,
        reminderLevel: reminderStatus.level
      });
    }

    res.json({
      total: results.length,
      data: results
    });
  } catch (error) {
    console.error('获取会员列表失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.get('/levels', authenticateToken, async (req, res) => {
  try {
    const levels = db.prepare(
      'SELECT * FROM membership_levels WHERE is_active = 1 ORDER BY sort_order'
    ).all();
    res.json(levels);
  } catch (error) {
    console.error('获取会员等级失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const feeYear = parseInt(year || new Date().getFullYear());
    
    const member = db.prepare(`
      SELECT m.*, ml.level_name, ml.level_code
      FROM members m
      LEFT JOIN membership_levels ml ON m.member_level_id = ml.id
      WHERE m.id = ?
    `).get(req.params.id);

    if (!member) {
      return res.status(404).json({ error: '会员不存在' });
    }

    const feeResult = await FeeService.calculateMemberFee(member.id, feeYear);
    const reminderStatus = await FeeService.getMemberReminderStatus(member);

    const payments = db.prepare(`
      SELECT p.*, u.real_name as creator_name
      FROM payments p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.member_id = ? AND p.status = 'paid'
      ORDER BY p.fee_year DESC, p.payment_date DESC
    `).all(member.id);

    const reductions = db.prepare(`
      SELECT rr.*, u1.real_name as creator_name, u2.real_name as approver_name
      FROM reduction_requests rr
      LEFT JOIN users u1 ON rr.created_by = u1.id
      LEFT JOIN users u2 ON rr.approved_by = u2.id
      WHERE rr.member_id = ?
      ORDER BY rr.fee_year DESC, rr.created_at DESC
    `).all(member.id);

    res.json({
      ...member,
      memberLevelName: member.level_name,
      memberLevelCode: member.level_code,
      feeInfo: feeResult,
      reminderStatus,
      payments,
      reductions
    });
  } catch (error) {
    console.error('获取会员详情失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/', authenticateToken, [
  body('companyName').notEmpty().withMessage('企业名称不能为空'),
  body('memberLevelId').notEmpty().withMessage('会员等级不能为空'),
  body('joinDate').notEmpty().withMessage('入会时间不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      companyName, legalPerson, contactPerson, contactPhone, address,
      industry, memberLevelId, isSmallEnterprise, joinDate, expiryDate, note
    } = req.body;

    const countResult = db.prepare('SELECT COUNT(*) as count FROM members').get();
    const memberCode = `HY${String(countResult.count + 1).padStart(3, '0')}`;

    const result = db.prepare(`
      INSERT INTO members 
      (member_code, company_name, legal_person, contact_person, contact_phone, address, 
       industry, member_level_id, is_small_enterprise, join_date, expiry_date, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      memberCode, companyName, legalPerson, contactPerson, contactPhone, address,
      industry, memberLevelId, isSmallEnterprise ? 1 : 0, joinDate, expiryDate || null, note
    );

    res.json({
      id: result.lastInsertRowid,
      memberCode,
      message: '会员创建成功'
    });
  } catch (error) {
    console.error('创建会员失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      companyName, legalPerson, contactPerson, contactPhone, address,
      industry, memberLevelId, isSmallEnterprise, joinDate, expiryDate, status, note
    } = req.body;

    db.prepare(`
      UPDATE members SET 
        company_name = ?, legal_person = ?, contact_person = ?, contact_phone = ?, 
        address = ?, industry = ?, member_level_id = ?, is_small_enterprise = ?,
        join_date = ?, expiry_date = ?, status = ?, note = ?
      WHERE id = ?
    `).run(
      companyName, legalPerson, contactPerson, contactPhone,
      address, industry, memberLevelId, isSmallEnterprise ? 1 : 0,
      joinDate, expiryDate || null, status, note,
      req.params.id
    );

    res.json({ message: '会员信息更新成功' });
  } catch (error) {
    console.error('更新会员失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const payments = db.prepare(
      'SELECT COUNT(*) as count FROM payments WHERE member_id = ?'
    ).get(req.params.id);
    
    if (payments.count > 0) {
      return res.status(400).json({ error: '该会员已有缴费记录，无法删除' });
    }

    db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
    res.json({ message: '会员删除成功' });
  } catch (error) {
    console.error('删除会员失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

module.exports = router;
