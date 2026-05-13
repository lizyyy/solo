const express = require('express');
const router = express.Router();
const db = require('../database');
const { checkIdempotency } = require('../middleware/idempotency');
const { addTimelineEvent } = require('../utils/timeline');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  db.all('SELECT * FROM batches ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', checkIdempotency('batch'), (req, res) => {
  const { batch_number, uniform_type, size_distribution, total_quantity, received_date } = req.body;
  
  db.run(
    'INSERT INTO batches (batch_number, uniform_type, size_distribution, total_quantity, received_date) VALUES (?, ?, ?, ?, ?)',
    [batch_number, uniform_type, JSON.stringify(size_distribution), total_quantity, received_date],
    async function(err) {
      if (err) {
        await addTimelineEvent('batch', req.body, 'failed', `批次创建失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('batch', { id: this.lastID, ...req.body }, 'success', `批次 ${batch_number} 创建成功`);
      res.json({ id: this.lastID, batch_number, uniform_type, size_distribution, total_quantity });
    }
  );
});

router.post('/distribute', checkIdempotency('distribute'), (req, res) => {
  const { employee_id, batch_id, size, quantity } = req.body;
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.run(
      'INSERT INTO distributions (employee_id, batch_id, size, quantity) VALUES (?, ?, ?, ?)',
      [employee_id, batch_id, size, quantity || 1],
      async function(err) {
        if (err) {
          db.run('ROLLBACK');
          await addTimelineEvent('distribute', req.body, 'failed', `发放失败: ${err.message}`);
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          'UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE size = ?',
          [quantity || 1, size],
          async function(err) {
            if (err) {
              db.run('ROLLBACK');
              await addTimelineEvent('distribute', req.body, 'failed', `库存更新失败: ${err.message}`);
              res.status(500).json({ error: err.message });
              return;
            }
            
            db.run('COMMIT');
            await addTimelineEvent('distribute', req.body, 'success', `发放成功: 尺码 ${size} x ${quantity || 1}`);
            res.json({ id: this.lastID, ...req.body });
          }
        );
      }
    );
  });
});

router.get('/distributions', (req, res) => {
  const query = `
    SELECT d.*, e.name as employee_name, e.employee_id, b.batch_number
    FROM distributions d
    JOIN employees e ON d.employee_id = e.id
    JOIN batches b ON d.batch_id = b.id
    ORDER BY d.distributed_at DESC
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;