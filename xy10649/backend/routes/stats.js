const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as count FROM gift_inventory', (err, row) => {
    stats.inventory = row;
    
    db.get('SELECT COUNT(*) as count FROM activity_plans', (err, row) => {
      stats.plans = row;
      
      db.get('SELECT COUNT(*) as count FROM customer_lists', (err, row) => {
        stats.customers = row;
        
        db.get('SELECT COUNT(*) as count FROM employee_claims WHERE status = "pending"', (err, row) => {
          stats.pending_claims = row;
          
          db.get('SELECT COUNT(*) as count FROM exception_records WHERE status = "pending"', (err, row) => {
            stats.pending_exceptions = row;
            
            db.get('SELECT COUNT(*) as count FROM return_inventory', (err, row) => {
              stats.returns = row;
              
              db.all('SELECT status, COUNT(*) as count FROM customer_lists GROUP BY status', (err, rows) => {
                stats.customer_status = rows;
                
                db.all('SELECT gift_type, SUM(quantity) as total FROM gift_inventory GROUP BY gift_type', (err, rows) => {
                  stats.inventory_by_type = rows;
                  
                  res.json({ data: stats });
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
