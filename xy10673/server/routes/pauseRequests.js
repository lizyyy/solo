const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

router.get('/', (req, res) => {
  const { status, subscription_id } = req.query;
  let query = `
    SELECT pr.*, s.subscriber_name, s.newspaper_name
    FROM pause_requests pr
    JOIN (
      SELECT s.id, sub.name as subscriber_name, n.name as newspaper_name
      FROM subscriptions s
      JOIN subscribers sub ON s.subscriber_id = sub.id
      JOIN newspapers n ON s.newspaper_id = n.id
    ) s ON pr.subscription_id = s.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }
  if (subscription_id) {
    query += ' AND pr.subscription_id = ?';
    params.push(subscription_id);
  }
  
  query += ' ORDER BY pr.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { subscription_id, start_date, end_date, reason, created_by } = req.body;
  const request_date = moment().format('YYYY-MM-DD');
  
  db.get(
    `SELECT COUNT(*) as count FROM delivery_calendar 
     WHERE subscription_id = ? AND delivery_date >= ? AND delivery_date <= ? AND status = 'delivered'`,
    [subscription_id, start_date, end_date],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (result.count > 0) {
        res.status(400).json({ error: '暂停日期范围内已有已投递记录，无法暂停' });
        return;
      }
      
      db.run(
        `INSERT INTO pause_requests (subscription_id, request_date, start_date, end_date, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [subscription_id, request_date, start_date, end_date, reason, created_by],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id: this.lastID, message: '暂停申请提交成功' });
        }
      );
    }
  );
});

router.put('/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  const approved_at = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT * FROM pause_requests WHERE id = ?', [req.params.id], (err, pauseRequest) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run(
        `UPDATE pause_requests SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [approved_by, approved_at, req.params.id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run(
            `UPDATE subscriptions SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [pauseRequest.subscription_id],
            (err) => {
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
                res.json({ message: '暂停申请已批准' });
              });
            }
          );
        }
      );
    });
  });
});

router.put('/:id', (req, res) => {
  const { start_date, end_date, reason, updated_by } = req.body;
  
  db.get('SELECT * FROM pause_requests WHERE id = ?', [req.params.id], (err, oldRequest) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `UPDATE pause_requests 
       SET start_date = ?, end_date = ?, reason = ?, 
           old_start_date = ?, old_end_date = ?, old_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [start_date, end_date, reason, oldRequest.start_date, oldRequest.end_date, oldRequest.reason, req.params.id],
      (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: '暂停申请已更新' });
      }
    );
  });
});

module.exports = router;
