const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { status, subscriber_id } = req.query;
  let query = `
    SELECT s.*, sub.name as subscriber_name, n.name as newspaper_name
    FROM subscriptions s
    JOIN subscribers sub ON s.subscriber_id = sub.id
    JOIN newspapers n ON s.newspaper_id = n.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }
  if (subscriber_id) {
    query += ' AND s.subscriber_id = ?';
    params.push(subscriber_id);
  }
  
  query += ' ORDER BY s.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT s.*, sub.name as subscriber_name, n.name as newspaper_name, sub.phone, sub.address
    FROM subscriptions s
    JOIN subscribers sub ON s.subscriber_id = sub.id
    JOIN newspapers n ON s.newspaper_id = n.id
    WHERE s.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/:id/adjust', (req, res) => {
  const { adjustment_type, old_value, new_value, reason, adjusted_by } = req.body;
  const subscription_id = req.params.id;
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `INSERT INTO manual_adjustments (subscription_id, adjustment_type, old_value, new_value, reason, adjusted_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subscription_id, adjustment_type, old_value, new_value, reason, adjusted_by],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        let updateQuery;
        if (adjustment_type === 'remaining_issues') {
          updateQuery = 'UPDATE subscriptions SET remaining_issues = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        } else if (adjustment_type === 'total_issues') {
          updateQuery = 'UPDATE subscriptions SET total_issues = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        } else {
          updateQuery = 'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        }
        
        db.run(updateQuery, [new_value, subscription_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run('COMMIT', (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            res.json({ id: this.lastID, message: '调整成功' });
          });
        });
      }
    );
  });
});

router.get('/:id/history', (req, res) => {
  const subscription_id = req.params.id;
  
  db.all(
    `SELECT * FROM manual_adjustments WHERE subscription_id = ? ORDER BY adjusted_at DESC`,
    [subscription_id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

module.exports = router;
