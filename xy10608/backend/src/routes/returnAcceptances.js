
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation, logChanges } = require('../utils');

const router = express.Router();

// 获取所有退料验收
router.get('/', (req, res) => {
  try {
    const returns = db.prepare(`
      SELECT * FROM return_acceptances ORDER BY created_at DESC
    `).all();
    res.json(returns);
  } catch (error) {
    console.error('获取退料验收失败:', error);
    res.status(500).json({ error: '获取退料验收失败' });
  }
});

// 创建退料验收
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { return_number, store_id, store_name, ingredient_code, ingredient_name, batch_number, returned_quantity, unit, reason } = req.body;
  
  if (!return_number || !store_id || !store_name || !ingredient_code || !ingredient_name || !batch_number || returned_quantity == null || !unit || !reason) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    const id = generateId();
    db.prepare(`
      INSERT INTO return_acceptances 
      (id, return_number, store_id, store_name, ingredient_code, ingredient_name, 
       batch_number, returned_quantity, accepted_quantity, unit, reason, status, 
       inspected_by, inspected_at, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      return_number,
      store_id,
      store_name,
      ingredient_code,
      ingredient_name,
      batch_number,
      returned_quantity,
      null,
      unit,
      reason,
      'pending',
      null,
      null,
      operator,
      now,
      now
    );
    
    logOperation(db, 'CREATE', 'return_acceptances', id, '创建退料验收', { return_number, ingredient_name }, operator);
    
    res.status(201).json({ id, message: '退料验收创建成功' });
  } catch (error) {
    console.error('创建退料验收失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '退料单号已存在' });
    }
    res.status(500).json({ error: '创建退料验收失败' });
  }
});

// 审核退料验收
router.post('/:id/inspect', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { status, accepted_quantity } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: '审核状态必填' });
  }
  
  try {
    const oldReturn = db.prepare('SELECT * FROM return_acceptances WHERE id = ?').get(req.params.id);
    if (!oldReturn) {
      return res.status(404).json({ error: '退料验收不存在' });
    }
    
    if (oldReturn.status !== 'pending') {
      return res.status(400).json({ error: '该退料验收已处理' });
    }
    
    db.prepare(`
      UPDATE return_acceptances 
      SET status = ?, accepted_quantity = ?, inspected_by = ?, inspected_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(
      status,
      accepted_quantity || null,
      operator,
      now,
      now,
      req.params.id
    );
    
    logChanges(db, 'return_acceptances', req.params.id, 
      { status: oldReturn.status, accepted_quantity: null, inspected_by: null, inspected_at: null }, 
      { status, accepted_quantity: accepted_quantity || null, inspected_by: operator, inspected_at: now }, 
      operator
    );
    
    logOperation(db, 'INSPECT', 'return_acceptances', req.params.id, '审核退料验收', { return_number: oldReturn.return_number, status }, operator);
    
    res.json({ message: '退料验收审核完成' });
  } catch (error) {
    console.error('审核退料验收失败:', error);
    res.status(500).json({ error: '审核退料验收失败' });
  }
});

module.exports = router;
