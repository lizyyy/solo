const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM replenishment_alert ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM replenishment_alert WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/:id/handle', (req, res) => {
  const { handle_result, replenishment_quantity, handler_id, handler_name, callback_id } = req.body;
  const alertId = req.params.id;
  const now = new Date().toISOString();
  
  if (callback_id) {
    db.get('SELECT * FROM callback_record WHERE callback_id = ?', [callback_id], (err, row) => {
      if (row) {
        res.json({ message: '重复回调，已跳过处理', isDuplicate: true });
        return;
      }
      processHandle();
    });
  } else {
    processHandle();
  }
  
  function processHandle() {
    db.get('SELECT * FROM replenishment_alert WHERE id = ?', [alertId], (err, alert) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!alert) {
        res.status(404).json({ error: '预警记录不存在' });
        return;
      }
      
      if (alert.status !== 'pending') {
        res.status(400).json({ error: '当前预警已处理' });
        return;
      }
      
      db.serialize(async () => {
        db.run('BEGIN TRANSACTION');
        
        try {
          const updates = [];
          const params = [];
          
          updates.push('status = ?');
          params.push('handled');
          
          updates.push('handle_result = ?');
          params.push(handle_result);
          
          updates.push('handler_id = ?');
          params.push(handler_id);
          
          updates.push('handler_name = ?');
          params.push(handler_name);
          
          updates.push('handle_date = ?');
          params.push(now);
          
          if (replenishment_quantity) {
            updates.push('replenishment_quantity = ?');
            params.push(replenishment_quantity);
            
            db.get('SELECT * FROM sku WHERE id = ?', [alert.sku_id], (skuErr, sku) => {
              if (!skuErr && sku) {
                const newStock = sku.current_stock + replenishment_quantity;
                const oldStock = sku.current_stock;
                db.run('UPDATE sku SET current_stock = ?, updated_at = ? WHERE id = ?', [newStock, now, alert.sku_id]);
                logOperation('sku', alert.sku_id, 'update', 'current_stock', oldStock, newStock, handler_id, handler_name, '补货入库');
              }
            });
          }
          
          updates.push('updated_at = ?');
          params.push(now);
          params.push(alertId);
          
          const sql = `UPDATE replenishment_alert SET ${updates.join(', ')} WHERE id = ?`;
          db.run(sql, params);
          
          await logOperation('replenishment_alert', alertId, 'handle', 'status', 'pending', 'handled', handler_id, handler_name, '处理补货预警：' + handle_result);
          
          if (callback_id) {
            const callbackRecordId = uuidv4();
            db.run(
              'INSERT INTO callback_record (id, callback_id, business_type, business_id, processed_at, status) VALUES (?, ?, ?, ?, ?, ?)',
              [callbackRecordId, callback_id, 'replenishment_alert', alertId, now, 'processed']
            );
          }
          
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK');
              res.status(500).json({ error: commitErr.message });
              return;
            }
            res.json({ id: alertId, status: 'handled' });
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