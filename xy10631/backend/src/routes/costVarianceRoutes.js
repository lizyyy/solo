const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM cost_variance ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM cost_variance WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/calculate', (req, res) => {
  const { sku_id, sku_code, period, expected_cost, actual_cost, created_by } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const variance = actual_cost - expected_cost;
  const variance_rate = expected_cost > 0 ? (variance / expected_cost) * 100 : 0;
  
  const sql = `
    INSERT INTO cost_variance (id, sku_id, sku_code, period, expected_cost, actual_cost, variance, variance_rate, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `;
  
  db.run(sql, [id, sku_id, sku_code, period, expected_cost, actual_cost, variance, variance_rate, now, now], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    await logOperation('cost_variance', id, 'create', null, null, null, created_by, '系统', '计算成本差异');
    res.json({ id, sku_code, period, variance, variance_rate });
  });
});

router.post('/:id/review', (req, res) => {
  const { analysis, reviewer_id, reviewer_name } = req.body;
  const varianceId = req.params.id;
  const now = new Date().toISOString();
  
  db.get('SELECT * FROM cost_variance WHERE id = ?', [varianceId], async (err, variance) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!variance) {
      res.status(404).json({ error: '成本差异记录不存在' });
      return;
    }
    
    const sql = `
      UPDATE cost_variance 
      SET analysis = ?, reviewer_id = ?, reviewer_name = ?, review_date = ?, status = 'reviewed', updated_at = ? 
      WHERE id = ?
    `;
    
    db.run(sql, [analysis, reviewer_id, reviewer_name, now, now, varianceId], async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      await logOperation('cost_variance', varianceId, 'review', 'status', 'pending', 'reviewed', reviewer_id, reviewer_name, '复核成本差异');
      res.json({ id: varianceId, status: 'reviewed' });
    });
  });
});

module.exports = router;