
const express = require('express');
const { db } = require('../database');
const { generateId, getCurrentTime, logOperation } = require('../utils');

const router = express.Router();

// 获取所有门店成本（带筛选）
router.get('/', (req, res) => {
  try {
    let query = 'SELECT * FROM store_costs WHERE 1=1';
    const params = [];
    
    if (req.query.store_id) {
      query += ' AND store_id = ?';
      params.push(req.query.store_id);
    }
    if (req.query.cost_type) {
      query += ' AND cost_type = ?';
      params.push(req.query.cost_type);
    }
    if (req.query.created_by) {
      query += ' AND created_by = ?';
      params.push(req.query.created_by);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const costs = db.prepare(query).all(...params);
    res.json(costs);
  } catch (error) {
    console.error('获取门店成本失败:', error);
    res.status(500).json({ error: '获取门店成本失败' });
  }
});

// 记录门店成本（带幂等性检查）
router.post('/', (req, res) => {
  const now = getCurrentTime();
  const operator = req.headers['x-operator'] || 'system';
  const { transaction_id, store_id, store_name, menu_code, menu_name, ingredient_code, ingredient_name, quantity, unit, unit_price, total_cost, cost_type } = req.body;
  
  if (!transaction_id || !store_id || !store_name || !ingredient_code || !ingredient_name || quantity == null || !unit || unit_price == null || total_cost == null || !cost_type) {
    return res.status(400).json({ error: '必填参数缺失' });
  }
  
  try {
    // 检查是否已存在相同的 transaction_id（幂等性）
    const existing = db.prepare('SELECT * FROM store_costs WHERE transaction_id = ?').get(transaction_id);
    if (existing) {
      console.log(`发现重复请求，transaction_id: ${transaction_id}，跳过重复处理`);
      return res.json({ 
        message: '重复请求，已跳过', 
        isDuplicate: true,
        existingRecord: existing
      });
    }
    
    // 检查过敏原限制和拦截逻辑
    let shouldBlock = false;
    let blockReason = '';
    
    // 检查食材是否有过敏原
    const allergenCheck = db.prepare(`
      SELECT ar.* FROM allergen_restrictions ar
      WHERE ar.store_id = ? AND ar.is_active = 1
    `).all(store_id);
    
    const batchAllergens = db.prepare(`
      SELECT allergens FROM ingredient_batches 
      WHERE ingredient_code = ? AND status != 'unavailable'
      ORDER BY created_at DESC LIMIT 1
    `).get(ingredient_code);
    
    if (batchAllergens && batchAllergens.allergens) {
      const allergensList = batchAllergens.allergens.split(',').map(a => a.trim());
      for (const restriction of allergenCheck) {
        if (allergensList.includes(restriction.allergen_type)) {
          if (restriction.restriction_level === '严格禁止') {
            shouldBlock = true;
            blockReason = `食材含有过敏原 ${restriction.allergen_type}，该门店严格禁止使用`;
          }
        }
      }
    }
    
    const finalCostType = shouldBlock ? 'blocked' : cost_type;
    
    const id = generateId();
    db.prepare(`
      INSERT INTO store_costs 
      (id, transaction_id, store_id, store_name, menu_code, menu_name, ingredient_code, 
       ingredient_name, quantity, unit, unit_price, total_cost, cost_type, created_by, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      transaction_id,
      store_id,
      store_name,
      menu_code || null,
      menu_name || null,
      ingredient_code,
      ingredient_name,
      quantity,
      unit,
      unit_price,
      shouldBlock ? 0 : total_cost, // 如果拦截，成本记为0
      finalCostType,
      operator,
      now
    );
    
    logOperation(db, 'CREATE', 'store_costs', id, '记录门店成本', { 
      store_name, 
      ingredient_name, 
      total_cost: shouldBlock ? 0 : total_cost,
      blocked: shouldBlock,
      blockReason
    }, operator);
    
    res.status(201).json({ 
      id, 
      message: shouldBlock ? '门店成本已记录（因过敏原限制已拦截）' : '门店成本记录成功',
      blocked: shouldBlock,
      blockReason
    });
  } catch (error) {
    console.error('记录门店成本失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.json({ 
        message: '重复请求，已跳过', 
        isDuplicate: true 
      });
    }
    res.status(500).json({ error: '记录门店成本失败' });
  }
});

// 获取统计数据
router.get('/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        store_name,
        cost_type,
        COUNT(*) as count,
        SUM(total_cost) as total_amount
      FROM store_costs
      GROUP BY store_name, cost_type
      ORDER BY store_name, cost_type
    `).all();
    
    res.json(stats);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

module.exports = router;
