const express = require('express');
const router = express.Router();
const db = require('../database');
const { addTimelineEvent } = require('../utils/timeline');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY size', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/stock', (req, res) => {
  const { size, quantity } = req.body;
  
  db.run(
    'INSERT INTO inventory (size, quantity) VALUES (?, ?) ON CONFLICT(size) DO UPDATE SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP',
    [size, quantity, quantity],
    async function(err) {
      if (err) {
        await addTimelineEvent('inventory', req.body, 'failed', `入库失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('inventory', req.body, 'success', `入库成功: 尺码 ${size} x ${quantity}`);
      res.json({ size, quantity });
    }
  );
});

router.get('/discrepancies', (req, res) => {
  db.all('SELECT * FROM inventory_discrepancies ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/discrepancy', (req, res) => {
  const { size, expected_quantity, actual_quantity } = req.body;
  const discrepancy_id = `DIS-${Date.now()}`;
  const difference = actual_quantity - expected_quantity;
  
  db.run(
    'INSERT INTO inventory_discrepancies (discrepancy_id, size, expected_quantity, actual_quantity, difference, status) VALUES (?, ?, ?, ?, ?, ?)',
    [discrepancy_id, size, expected_quantity, actual_quantity, difference, 'pending'],
    async function(err) {
      if (err) {
        await addTimelineEvent('discrepancy', req.body, 'failed', `差异记录创建失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('discrepancy', { discrepancy_id, ...req.body }, 'success', 
        `库存差异记录创建: 尺码 ${size}, 差异 ${difference}`);
      res.json({ discrepancy_id, size, expected_quantity, actual_quantity, difference, status: 'pending' });
    }
  );
});

router.put('/discrepancy/:discrepancy_id/review', (req, res) => {
  const { discrepancy_id } = req.params;
  const { review_notes, reviewed_by, adjust_inventory } = req.body;
  
  db.get('SELECT * FROM inventory_discrepancies WHERE discrepancy_id = ?', [discrepancy_id], (err, discrepancy) => {
    if (err || !discrepancy) {
      res.status(404).json({ error: '差异记录不存在' });
      return;
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      if (adjust_inventory) {
        db.run(
          'UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE size = ?',
          [discrepancy.actual_quantity, discrepancy.size],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
            }
          }
        );
      }
      
      db.run(
        'UPDATE inventory_discrepancies SET status = ?, review_notes = ?, reviewed_by = ? WHERE discrepancy_id = ?',
        ['reviewed', review_notes, reviewed_by, discrepancy_id],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            await addTimelineEvent('discrepancy_review', { discrepancy_id }, 'failed', `复核失败: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run('COMMIT');
          await addTimelineEvent('discrepancy_review', { discrepancy_id }, 'manual', 
            `库存差异已复核: ${discrepancy_id}`);
          res.json({ reviewed: true, discrepancy_id });
        }
      );
    });
  });
});

router.get('/purchase-suggestions', (req, res) => {
  db.all('SELECT * FROM purchase_suggestions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/purchase-suggestion', (req, res) => {
  const { size, suggested_quantity, reason } = req.body;
  
  db.run(
    'INSERT INTO purchase_suggestions (size, suggested_quantity, reason) VALUES (?, ?, ?)',
    [size, suggested_quantity, reason],
    async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('purchase', { size, suggested_quantity }, 'success', 
        `采购建议创建: 尺码 ${size} x ${suggested_quantity}`);
      res.json({ id: this.lastID, size, suggested_quantity, reason });
    }
  );
});

router.post('/generate-suggestions', (req, res) => {
  db.all('SELECT * FROM inventory WHERE quantity < 5', [], async (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const suggestions = [];
    for (const item of rows) {
      const suggested = 10 - item.quantity;
      if (suggested > 0) {
        await new Promise((resolve) => {
          db.run(
            'INSERT INTO purchase_suggestions (size, suggested_quantity, reason) VALUES (?, ?, ?)',
            [item.size, suggested, '库存低于安全阈值'],
            function() {
              suggestions.push({ size: item.size, suggested_quantity: suggested, id: this.lastID });
              resolve();
            }
          );
        });
      }
    }
    
    await addTimelineEvent('purchase_generate', { count: suggestions.length }, 'success', 
      `自动生成 ${suggestions.length} 条采购建议`);
    res.json({ generated: suggestions.length, suggestions });
  });
});

module.exports = router;