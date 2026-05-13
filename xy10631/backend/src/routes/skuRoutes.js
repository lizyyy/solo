const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM sku ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM sku WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { sku_code, name, category, unit, unit_price, safety_stock, current_stock, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const sql = `
    INSERT INTO sku (id, sku_code, name, category, unit, unit_price, safety_stock, current_stock, status, created_at, updated_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `;
  
  db.run(sql, [id, sku_code, name, category, unit, unit_price, safety_stock, current_stock, now, now, created_by], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    await logOperation('sku', id, 'create', null, null, null, created_by, '系统', '创建SKU');
    res.json({ id, sku_code, name });
  });
});

router.put('/:id', (req, res) => {
  const { name, category, unit, unit_price, safety_stock, current_stock, status, updated_by } = req.body;
  const skuId = req.params.id;
  const now = new Date().toISOString();
  
  db.get('SELECT * FROM sku WHERE id = ?', [skuId], async (err, oldSku) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined && name !== oldSku.name) {
      updates.push('name = ?');
      params.push(name);
      await logOperation('sku', skuId, 'update', 'name', oldSku.name, name, updated_by || 'system', '修改SKU名称');
    }
    if (category !== undefined && category !== oldSku.category) {
      updates.push('category = ?');
      params.push(category);
      await logOperation('sku', skuId, 'update', 'category', oldSku.category, category, updated_by || 'system', '修改SKU分类');
    }
    if (unit !== undefined && unit !== oldSku.unit) {
      updates.push('unit = ?');
      params.push(unit);
      await logOperation('sku', skuId, 'update', 'unit', oldSku.unit, unit, updated_by || 'system', '修改SKU单位');
    }
    if (unit_price !== undefined && unit_price !== oldSku.unit_price) {
      updates.push('unit_price = ?');
      params.push(unit_price);
      await logOperation('sku', skuId, 'update', 'unit_price', oldSku.unit_price, unit_price, updated_by || 'system', '修改SKU单价');
    }
    if (safety_stock !== undefined && safety_stock !== oldSku.safety_stock) {
      updates.push('safety_stock = ?');
      params.push(safety_stock);
      await logOperation('sku', skuId, 'update', 'safety_stock', oldSku.safety_stock, safety_stock, updated_by || 'system', '修改安全库存');
    }
    if (current_stock !== undefined && current_stock !== oldSku.current_stock) {
      updates.push('current_stock = ?');
      params.push(current_stock);
      await logOperation('sku', skuId, 'update', 'current_stock', oldSku.current_stock, current_stock, updated_by || 'system', '修改当前库存');
    }
    if (status !== undefined && status !== oldSku.status) {
      updates.push('status = ?');
      params.push(status);
      await logOperation('sku', skuId, 'update', 'status', oldSku.status, status, updated_by || 'system', '修改SKU状态');
    }
    
    if (updates.length === 0) {
      res.json({ message: '没有需要更新的字段' });
      return;
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(skuId);
    
    const sql = `UPDATE sku SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, params, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: skuId, changes: this.changes });
    });
  });
});

module.exports = router;