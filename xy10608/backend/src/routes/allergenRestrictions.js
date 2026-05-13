
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation, logChanges } = require('../utils');

const router = express.Router();

// 获取所有过敏原限制
router.get('/', (req, res) => {
  try {
    const restrictions = db.prepare(`
      SELECT * FROM allergen_restrictions ORDER BY created_at DESC
    `).all();
    res.json(restrictions);
  } catch (error) {
    console.error('获取过敏原限制失败:', error);
    res.status(500).json({ error: '获取过敏原限制失败' });
  }
});

// 创建过敏原限制
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { store_id, store_name, allergen_type, restriction_level, effective_date, expiry_date, is_active } = req.body;
  
  if (!store_id || !store_name || !allergen_type || !restriction_level || !effective_date) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    const id = generateId();
    db.prepare(`
      INSERT INTO allergen_restrictions 
      (id, store_id, store_name, allergen_type, restriction_level, effective_date, 
       expiry_date, is_active, created_by, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      store_id,
      store_name,
      allergen_type,
      restriction_level,
      effective_date,
      expiry_date || null,
      is_active !== undefined ? is_active : 1,
      operator,
      now,
      now
    );
    
    logOperation(db, 'CREATE', 'allergen_restrictions', id, '创建过敏原限制', { store_name, allergen_type }, operator);
    
    res.status(201).json({ id, message: '过敏原限制创建成功' });
  } catch (error) {
    console.error('创建过敏原限制失败:', error);
    res.status(500).json({ error: '创建过敏原限制失败' });
  }
});

// 更新过敏原限制
router.put('/:id', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  
  try {
    const oldRestriction = db.prepare('SELECT * FROM allergen_restrictions WHERE id = ?').get(req.params.id);
    if (!oldRestriction) {
      return res.status(404).json({ error: '过敏原限制不存在' });
    }
    
    const updateData = {};
    const fields = ['store_id', 'store_name', 'allergen_type', 'restriction_level', 'effective_date', 'expiry_date', 'is_active'];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    
    updateData.updated_at = now;
    
    logChanges(db, 'allergen_restrictions', req.params.id, oldRestriction, updateData, operator);
    
    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), req.params.id];
    
    db.prepare(`UPDATE allergen_restrictions SET ${setClause} WHERE id = ?`).run(...values);
    
    logOperation(db, 'UPDATE', 'allergen_restrictions', req.params.id, '更新过敏原限制', { store_name: oldRestriction.store_name }, operator);
    
    res.json({ message: '过敏原限制更新成功' });
  } catch (error) {
    console.error('更新过敏原限制失败:', error);
    res.status(500).json({ error: '更新过敏原限制失败' });
  }
});

module.exports = router;
