const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as count FROM vehicle_mileage', (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    stats.vehicles = result.count;
    
    db.get('SELECT COUNT(*) as count FROM package_orders', (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      stats.orders = result.count;
      
      db.get('SELECT COUNT(*) as count FROM verification_records WHERE DATE(created_at) = DATE("now")', (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        stats.today_verifications = result.count;
        
        db.get('SELECT COUNT(*) as count FROM exceptions WHERE status = "pending"', (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          stats.pending_exceptions = result.count;
          
          db.get('SELECT COUNT(*) as count FROM next_reminders WHERE status = "pending"', (err, result) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            stats.pending_reminders = result.count;
            
            db.get('SELECT SUM(total_amount) as total FROM verification_records', (err, result) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              stats.total_revenue = result.total || 0;
              
              db.get('SELECT COUNT(*) as count FROM maintenance_items', (err, result) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                stats.items = result.count;
                
                res.json(stats);
              });
            });
          });
        });
      });
    });
  });
});

router.get('/handler-ranking', (req, res) => {
  db.all(
    `SELECT handler, COUNT(*) as count, SUM(total_amount) as total 
     FROM verification_records 
     GROUP BY handler 
     ORDER BY count DESC 
     LIMIT 10`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

router.get('/monthly-data', (req, res) => {
  db.all(
    `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(total_amount) as total 
     FROM verification_records 
     GROUP BY month 
     ORDER BY month DESC 
     LIMIT 12`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
