const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

router.get('/', (req, res) => {
  const { subscription_id, status, start_date, end_date } = req.query;
  let query = `
    SELECT dc.*, sub.name as subscriber_name, n.name as newspaper_name
    FROM delivery_calendar dc
    JOIN subscriptions s ON dc.subscription_id = s.id
    JOIN subscribers sub ON s.subscriber_id = sub.id
    JOIN newspapers n ON s.newspaper_id = n.id
    WHERE 1=1
  `;
  const params = [];
  
  if (subscription_id) {
    query += ' AND dc.subscription_id = ?';
    params.push(subscription_id);
  }
  if (status) {
    query += ' AND dc.status = ?';
    params.push(status);
  }
  if (start_date) {
    query += ' AND dc.delivery_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND dc.delivery_date <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY dc.delivery_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/:id/redelivery', (req, res) => {
  const { reason, new_delivery_date, created_by } = req.body;
  const delivery_id = req.params.id;
  const request_date = moment().format('YYYY-MM-DD');
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.run(
      `INSERT INTO re_deliveries (delivery_id, request_date, reason, new_delivery_date, handled_by)
       VALUES (?, ?, ?, ?, ?)`,
      [delivery_id, request_date, reason, new_delivery_date, created_by],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          `UPDATE delivery_calendar SET status = 're_delivering' WHERE id = ?`,
          [delivery_id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }
            
            db.run(
              `INSERT INTO exceptions (type, related_id, description, status, priority, assigned_to)
               VALUES ('redelivery', ?, ?, 'open', 'high', ?)`,
              [delivery_id, reason, created_by],
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
                  res.json({ id: this.lastID, message: '补投申请已提交' });
                });
              }
            );
          }
        );
      }
    );
  });
});

router.get('/redeliveries', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT rd.*, dc.delivery_date, dc.issue_number, sub.name as subscriber_name, n.name as newspaper_name
    FROM re_deliveries rd
    JOIN delivery_calendar dc ON rd.delivery_id = dc.id
    JOIN subscriptions s ON dc.subscription_id = s.id
    JOIN subscribers sub ON s.subscriber_id = sub.id
    JOIN newspapers n ON s.newspaper_id = n.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND rd.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY rd.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.put('/redeliveries/:id/complete', (req, res) => {
  const { handled_by, notes } = req.body;
  const handled_at = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT * FROM re_deliveries WHERE id = ?', [req.params.id], (err, reDelivery) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run(
        `UPDATE re_deliveries SET status = 'completed', handled_by = ?, handled_at = ?, notes = ?
         WHERE id = ?`,
        [handled_by, handled_at, notes, req.params.id],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run(
            `UPDATE delivery_calendar SET status = 'delivered', delivered_at = ? WHERE id = ?`,
            [handled_at, reDelivery.delivery_id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }
              
              db.run(
                `UPDATE exceptions SET status = 'resolved', handled_by = ?, handled_at = ?, resolution = ?
                 WHERE type = 'redelivery' AND related_id = ?`,
                [handled_by, handled_at, notes, reDelivery.delivery_id],
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
                    res.json({ message: '补投已完成' });
                  });
                }
              );
            }
          );
        }
      );
    });
  });
});

module.exports = router;
