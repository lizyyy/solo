
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation, logChanges } = require('../utils');

const router = express.Router();

// 获取所有食材批次
router.get('/', (req, res) => {
  try {
    const batches = db.prepare(`
      SELECT * FROM ingredient_batches ORDER BY created_at DESC
    `).all();
    res.json(batches);
  } catch (error) {
    console.error('获取食材批次失败:', error);
    res.status(500).json({ error: '获取食材批次失败' });
  }
});

// 获取单个食材批次
router.get('/:id', (req, res) => {
  try {
    const batch = db.prepare('SELECT * FROM ingredient_batches WHERE id = ?').get(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '食材批次不存在' });
    }
    res.json(batch);
  } catch (error) {
    console.error('获取食材批次失败:', error);
    res.status(500).json({ error: '获取食材批次失败' });
  }
});

// 创建食材批次
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { ingredient_code, ingredient_name, batch_number, supplier, production_date, expiry_date, quantity, unit, allergens } = req.body;
  
  if (!ingredient_code || !ingredient_name || !batch_number || !supplier || !production_date || !expiry_date || quantity == null || !unit) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    const id = generateId();
    db.prepare(`
      INSERT INTO ingredient_batches 
      (id, ingredient_code, ingredient_name, batch_number, supplier, production_date, expiry_date, 
       quantity, unit, allergens, status, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ingredient_code,
      ingredient_name,
      batch_number,
      supplier,
      production_date,
      expiry_date,
      quantity,
      unit,
      allergens || '',
      'available',
      operator,
      now,
      now
    );
    
    logOperation(db, 'CREATE', 'ingredient_batches', id, '创建食材批次', { ingredient_name, batch_number }, operator);
    
    res.status(201).json({ id, message: '食材批次创建成功' });
  } catch (error) {
    console.error('创建食材批次失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '批次号已存在' });
    }
    res.status(500).json({ error: '创建食材批次失败' });
  }
});

// 更新食材批次
router.put('/:id', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const oldBatch = db.prepare('SELECT * FROM ingredient_batches WHERE id = ?').get(req.params.id);
    if (!oldBatch) {
      return res.status(404).json({ error: '食材批次不存在' });
    }
    
    const updateData = {};
    const fields = ['ingredient_code', 'ingredient_name', 'batch_number', 'supplier', 'production_date', 'expiry_date', 'quantity', 'unit', 'allergens', 'status'];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    
    updateData.updated_at = now;
    
    logChanges(db, 'ingredient_batches', req.params.id, oldBatch, updateData, operator);
    
    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), req.params.id];
    
    db.prepare(`UPDATE ingredient_batches SET ${setClause} WHERE id = ?`).run(...values);
    
    logOperation(db, 'UPDATE', 'ingredient_batches', req.params.id, '更新食材批次', { ingredient_name: oldBatch.ingredient_name }, operator);
    
    res.json({ message: '食材批次更新成功' });
  } catch (error) {
    console.error('更新食材批次失败:', error);
    res.status(500).json({ error: '更新食材批次失败' });
  }
});

// 删除食材批次
router.delete('/:id', (req, res) => {
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const batch = db.prepare('SELECT * FROM ingredient_batches WHERE id = ?').get(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '食材批次不存在' });
    }
    
    db.prepare('DELETE FROM ingredient_batches WHERE id = ?').run(req.params.id);
    logOperation(db, 'DELETE', 'ingredient_batches', req.params.id, '删除食材批次', { ingredient_name: batch.ingredient_name }, operator);
    
    res.json({ message: '食材批次删除成功' });
  } catch (error) {
    console.error('删除食材批次失败:', error);
    res.status(500).json({ error: '删除食材批次失败' });
  }
});

module.exports = router;
