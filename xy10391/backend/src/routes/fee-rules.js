const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { year, levelId } = req.query;
    
    let query = `
      SELECT fr.*, ml.level_name, ml.level_code
      FROM fee_rules fr
      LEFT JOIN membership_levels ml ON fr.member_level_id = ml.id
      WHERE 1=1
    `;
    const params = [];

    if (year) {
      query += ' AND fr.effective_year = ?';
      params.push(year);
    }

    if (levelId) {
      query += ' AND fr.member_level_id = ?';
      params.push(levelId);
    }

    query += ' ORDER BY fr.effective_year DESC, ml.sort_order';

    const rules = db.prepare(query).all(...params);
    res.json({
      total: rules.length,
      data: rules
    });
  } catch (error) {
    console.error('获取会费规则失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.post('/', authenticateToken, requireRole('admin', 'manager'), [
  body('ruleName').notEmpty().withMessage('规则名称不能为空'),
  body('memberLevelId').notEmpty().withMessage('会员等级不能为空'),
  body('feeAmount').notEmpty().withMessage('会费金额不能为空').isFloat({ min: 0 }).withMessage('会费金额不能为负数'),
  body('effectiveYear').notEmpty().withMessage('生效年度不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ruleName, memberLevelId, feeAmount, effectiveYear, description } = req.body;

    const existing = db.prepare(`
      SELECT * FROM fee_rules WHERE member_level_id = ? AND effective_year = ?
    `).get(memberLevelId, effectiveYear);

    if (existing) {
      return res.status(400).json({ error: '该等级在该年度已有会费规则' });
    }

    const result = db.prepare(`
      INSERT INTO fee_rules (rule_name, member_level_id, fee_amount, effective_year, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(ruleName, memberLevelId, feeAmount, effectiveYear, description);

    res.json({
      id: result.lastInsertRowid,
      message: '会费规则创建成功'
    });
  } catch (error) {
    console.error('创建会费规则失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.put('/:id', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { ruleName, memberLevelId, feeAmount, effectiveYear, description } = req.body;

    db.prepare(`
      UPDATE fee_rules SET 
        rule_name = ?, member_level_id = ?, fee_amount = ?, 
        effective_year = ?, description = ?
      WHERE id = ?
    `).run(ruleName, memberLevelId, feeAmount, effectiveYear, description, req.params.id);

    res.json({ message: '会费规则更新成功' });
  } catch (error) {
    console.error('更新会费规则失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    db.prepare('DELETE FROM fee_rules WHERE id = ?').run(req.params.id);
    res.json({ message: '会费规则删除成功' });
  } catch (error) {
    console.error('删除会费规则失败:', error);
    res.status(500).json({ error: error.message || '服务器内部错误' });
  }
});

module.exports = router;
