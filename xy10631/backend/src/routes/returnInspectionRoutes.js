const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM return_inspection ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM return_inspection WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { usage_id, sku_id, return_quantity, inspector_id, inspector_name, notes } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.get('SELECT * FROM shift_usage WHERE id = ?', [usage_id], (err, usage) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!usage) {
      res.status(404).json({ error: '领用记录不存在' });
      return;
    }
    
    if (return_quantity > usage.quantity) {
      res.status(400).json({ error: '退回数量不能超过领用数量' });
      return;
    }
    
    const sql = `
      INSERT INTO return_inspection (id, usage_id, sku_id, return_quantity, inspector_id, inspector_name, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `;
    
    db.run(sql, [id, usage_id, sku_id, return_quantity, inspector_id, inspector_name, notes, now, now], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      await logOperation('return_inspection', id, 'create', null, null, null, inspector_id, inspector_name, '创建退回验收');
      res.json({ id, usage_id, return_quantity });
    });
  });
});

router.post('/:id/inspect', (req, res) => {
  const { inspection_result, rejection_reason, inspector_id, inspector_name, callback_id } = req.body;
  const inspectionId = req.params.id;
  const now = new Date().toISOString();
  
  if (callback_id) {
    db.get('SELECT * FROM callback_record WHERE callback_id = ?', [callback_id], (err, row) => {
      if (row) {
        res.json({ message: '重复回调，已跳过处理', isDuplicate: true });
        return;
      }
      processInspection();
    });
  } else {
    processInspection();
  }
  
  function processInspection() {
    db.get('SELECT * FROM return_inspection WHERE id = ?', [inspectionId], (err, inspection) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!inspection) {
        res.status(404).json({ error: '验收记录不存在' });
        return;
      }
      
      if (inspection.status !== 'pending') {
        res.status(400).json({ error: '当前状态不允许验收' });
        return;
      }
      
      db.serialize(async () => {
        db.run('BEGIN TRANSACTION');
        
        try {
          if (inspection_result === 'rejected') {
            db.run(
              'UPDATE return_inspection SET status = ?, inspection_result = ?, rejection_reason = ?, inspection_date = ?, updated_at = ? WHERE id = ?',
              ['rejected', inspection_result, rejection_reason, now, now, inspectionId]
            );
            await logOperation('return_inspection', inspectionId, 'status_update', 'status', 'pending', 'rejected', inspector_id, inspector_name, '退回验收拦截：' + rejection_reason);
          } else {
            db.run(
              'UPDATE return_inspection SET status = ?, inspection_result = ?, inspection_date = ?, updated_at = ? WHERE id = ?',
              ['approved', inspection_result, now, now, inspectionId]
            );
            
            db.get('SELECT * FROM sku WHERE id = ?', [inspection.sku_id], (skuErr, sku) => {
              if (!skuErr && sku) {
                const newStock = sku.current_stock + inspection.return_quantity;
                const oldStock = sku.current_stock;
                db.run('UPDATE sku SET current_stock = ?, updated_at = ? WHERE id = ?', [newStock, now, inspection.sku_id]);
                logOperation('sku', inspection.sku_id, 'update', 'current_stock', oldStock, newStock, inspector_id, inspector_name, '退回验收通过，增加库存');
              }
            });
            
            await logOperation('return_inspection', inspectionId, 'status_update', 'status', 'pending', 'approved', inspector_id, inspector_name, '退回验收通过');
          }
          
          if (callback_id) {
            const callbackRecordId = uuidv4();
            db.run(
              'INSERT INTO callback_record (id, callback_id, business_type, business_id, processed_at, status) VALUES (?, ?, ?, ?, ?, ?)',
              [callbackRecordId, callback_id, 'return_inspection', inspectionId, now, 'processed']
            );
          }
          
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK');
              res.status(500).json({ error: commitErr.message });
              return;
            }
            res.json({ id: inspectionId, status: inspection_result === 'rejected' ? 'rejected' : 'approved' });
          });
        } catch (logErr) {
          db.run('ROLLBACK');
          res.status(500).json({ error: logErr.message });
        }
      });
    });
  }
});

module.exports = router;