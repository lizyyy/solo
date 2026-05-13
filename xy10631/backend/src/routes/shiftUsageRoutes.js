const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');
const { checkAndRecordCallback } = require('../utils/callbackGuard');

router.get('/', (req, res) => {
  db.all('SELECT * FROM shift_usage ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM shift_usage WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { sku_id, sku_code, shift_date, shift_type, area_id, area_name, quantity, user_id, user_name, notes } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const sql = `
    INSERT INTO shift_usage (id, sku_id, sku_code, shift_date, shift_type, area_id, area_name, quantity, user_id, user_name, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `;
  
  db.run(sql, [id, sku_id, sku_code, shift_date, shift_type, area_id, area_name, quantity, user_id, user_name, notes, now, now], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    await logOperation('shift_usage', id, 'create', null, null, null, user_id, user_name, '创建班次领用');
    res.json({ id, sku_code, shift_date });
  });
});

router.post('/:id/approve', (req, res) => {
  const { approver_id, approver_name, callback_id } = req.body;
  const usageId = req.params.id;
  const now = new Date().toISOString();
  
  if (callback_id) {
    checkAndRecordCallback(callback_id, 'shift_usage_approve', usageId).then(result => {
      if (result.isDuplicate) {
        res.json({ message: '重复回调，已跳过处理', isDuplicate: true });
        return;
      }
      processApproval();
    }).catch(err => {
      res.status(500).json({ error: err.message });
    });
  } else {
    processApproval();
  }
  
  function processApproval() {
    db.get('SELECT * FROM shift_usage WHERE id = ?', [usageId], (err, usage) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (usage.status !== 'pending') {
        res.status(400).json({ error: '当前状态不允许审批' });
        return;
      }
      
      db.get('SELECT * FROM sku WHERE id = ?', [usage.sku_id], (skuErr, sku) => {
        if (skuErr) {
          res.status(500).json({ error: skuErr.message });
          return;
        }
        
        if (sku.current_stock < usage.quantity) {
          res.status(400).json({ error: '库存不足，无法审批通过' });
          return;
        }
        
        const newStock = sku.current_stock - usage.quantity;
        
        db.serialize(async () => {
          db.run('BEGIN TRANSACTION');
          
          try {
            db.run('UPDATE shift_usage SET status = ?, updated_at = ? WHERE id = ?', ['approved', now, usageId]);
            
            const oldStock = sku.current_stock;
            db.run('UPDATE sku SET current_stock = ?, updated_at = ? WHERE id = ?', [newStock, now, usage.sku_id]);
            await logOperation('sku', usage.sku_id, 'update', 'current_stock', oldStock, newStock, approver_id, approver_name, '领用审批扣减库存');
            
            await logOperation('shift_usage', usageId, 'status_update', 'status', 'pending', 'approved', approver_id, approver_name, '审批通过');
            
            if (newStock <= sku.safety_stock) {
              const alertId = uuidv4();
              const alertLevel = newStock <= sku.safety_stock * 0.5 ? 'high' : 'medium';
              
              db.run(`
                INSERT INTO replenishment_alert (id, sku_id, sku_code, alert_date, current_stock, threshold, alert_level, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
              `, [alertId, usage.sku_id, sku.sku_code, now, newStock, sku.safety_stock, alertLevel, now, now]);
              
              await logOperation('replenishment_alert', alertId, 'create', null, null, null, approver_id, approver_name, '库存低于安全线，触发补货预警');
            }
            
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: commitErr.message });
                return;
              }
              res.json({ id: usageId, status: 'approved', new_stock: newStock });
            });
          } catch (logErr) {
            db.run('ROLLBACK');
            res.status(500).json({ error: logErr.message });
          }
        });
      });
    });
  }
});

router.put('/:id', (req, res) => {
  const { quantity, notes, updated_by, updated_name } = req.body;
  const usageId = req.params.id;
  const now = new Date().toISOString();
  
  db.get('SELECT * FROM shift_usage WHERE id = ?', [usageId], async (err, oldUsage) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (oldUsage.status !== 'pending') {
      res.status(400).json({ error: '已审批的记录不能修改' });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (quantity !== undefined && quantity !== oldUsage.quantity) {
      updates.push('quantity = ?');
      params.push(quantity);
      await logOperation('shift_usage', usageId, 'update', 'quantity', oldUsage.quantity, quantity, updated_by, updated_name, '修改领用数量');
    }
    if (notes !== undefined && notes !== oldUsage.notes) {
      updates.push('notes = ?');
      params.push(notes);
      await logOperation('shift_usage', usageId, 'update', 'notes', oldUsage.notes, notes, updated_by, updated_name, '修改备注');
    }
    
    if (updates.length === 0) {
      res.json({ message: '没有需要更新的字段' });
      return;
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(usageId);
    
    const sql = `UPDATE shift_usage SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, params, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: usageId, changes: this.changes });
    });
  });
});

module.exports = router;