
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation, logChanges } = require('../utils');

const router = express.Router();

// 获取所有替代料确认
router.get('/', (req, res) => {
  try {
    const substitutions = db.prepare(`
      SELECT * FROM substitution_confirmations ORDER BY created_at DESC
    `).all();
    res.json(substitutions);
  } catch (error) {
    console.error('获取替代料确认失败:', error);
    res.status(500).json({ error: '获取替代料确认失败' });
  }
});

// 获取单个替代料确认
router.get('/:id', (req, res) => {
  try {
    const substitution = db.prepare('SELECT * FROM substitution_confirmations WHERE id = ?').get(req.params.id);
    if (!substitution) {
      return res.status(404).json({ error: '替代料确认不存在' });
    }
    res.json(substitution);
  } catch (error) {
    console.error('获取替代料确认失败:', error);
    res.status(500).json({ error: '获取替代料确认失败' });
  }
});

// 创建替代料确认
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { original_ingredient_code, original_ingredient_name, substitute_ingredient_code, substitute_ingredient_name, recipe_id, menu_name, reason } = req.body;
  
  if (!original_ingredient_code || !original_ingredient_name || !substitute_ingredient_code || !substitute_ingredient_name || !reason) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    const id = generateId();
    db.prepare(`
      INSERT INTO substitution_confirmations 
      (id, original_ingredient_code, original_ingredient_name, substitute_ingredient_code, 
       substitute_ingredient_name, recipe_id, menu_name, reason, status, approved_by, 
       approved_at, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      original_ingredient_code,
      original_ingredient_name,
      substitute_ingredient_code,
      substitute_ingredient_name,
      recipe_id || null,
      menu_name || null,
      reason,
      'pending',
      null,
      null,
      operator,
      now,
      now
    );
    
    logOperation(db, 'CREATE', 'substitution_confirmations', id, '创建替代料确认', { original_ingredient_name, substitute_ingredient_name }, operator);
    
    res.status(201).json({ id, message: '替代料确认创建成功' });
  } catch (error) {
    console.error('创建替代料确认失败:', error);
    res.status(500).json({ error: '创建替代料确认失败' });
  }
});

// 审核替代料确认
router.post('/:id/approve', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const oldSub = db.prepare('SELECT * FROM substitution_confirmations WHERE id = ?').get(req.params.id);
    if (!oldSub) {
      return res.status(404).json({ error: '替代料确认不存在' });
    }
    
    if (oldSub.status !== 'pending') {
      return res.status(400).json({ error: '该替代料确认已处理' });
    }
    
    db.prepare(`
      UPDATE substitution_confirmations 
      SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(
      'approved',
      operator,
      now,
      now,
      req.params.id
    );
    
    // 记录修改历史
    logChanges(db, 'substitution_confirmations', req.params.id, 
      { status: oldSub.status, approved_by: null, approved_at: null }, 
      { status: 'approved', approved_by: operator, approved_at: now }, 
      operator
    );
    
    logOperation(db, 'APPROVE', 'substitution_confirmations', req.params.id, '审核通过替代料确认', { original_ingredient_name: oldSub.original_ingredient_name }, operator);
    
    res.json({ message: '替代料确认审核通过' });
  } catch (error) {
    console.error('审核替代料确认失败:', error);
    res.status(500).json({ error: '审核替代料确认失败' });
  }
});

// 拒绝替代料确认
router.post('/:id/reject', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const oldSub = db.prepare('SELECT * FROM substitution_confirmations WHERE id = ?').get(req.params.id);
    if (!oldSub) {
      return res.status(404).json({ error: '替代料确认不存在' });
    }
    
    if (oldSub.status !== 'pending') {
      return res.status(400).json({ error: '该替代料确认已处理' });
    }
    
    db.prepare(`
      UPDATE substitution_confirmations 
      SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(
      'rejected',
      operator,
      now,
      now,
      req.params.id
    );
    
    logChanges(db, 'substitution_confirmations', req.params.id, 
      { status: oldSub.status, approved_by: null, approved_at: null }, 
      { status: 'rejected', approved_by: operator, approved_at: now }, 
      operator
    );
    
    logOperation(db, 'REJECT', 'substitution_confirmations', req.params.id, '拒绝替代料确认', { original_ingredient_name: oldSub.original_ingredient_name }, operator);
    
    res.json({ message: '替代料确认已拒绝' });
  } catch (error) {
    console.error('拒绝替代料确认失败:', error);
    res.status(500).json({ error: '拒绝替代料确认失败' });
  }
});

module.exports = router;
