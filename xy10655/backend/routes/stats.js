const express = require('express');
const router = express.Router();
const db = require('../database');
router.get('/', (req, res) => {
  db.serialize(() => {
    const stats = {};
    db.get('SELECT COUNT(*) as total FROM orders', (err, row) => {
      stats.total_orders = row.total;
      db.get('SELECT COUNT(*) as count FROM orders WHERE gift_qualified = 1', (err, row) => {
        stats.gift_qualified_orders = row.count;
        db.get('SELECT COUNT(*) as count FROM orders WHERE gift_qualified = 0 AND status != "pending"', (err, row) => {
          stats.gift_not_qualified_orders = row.count;
          db.get('SELECT COUNT(*) as count FROM split_orders', (err, row) => {
            stats.split_orders = row.count;
            db.get('SELECT COUNT(*) as count FROM refunds', (err, row) => {
              stats.refunds = row.count;
              db.get('SELECT COUNT(*) as count FROM refunds WHERE affect_gift = 1', (err, row) => {
                stats.refunds_affect_gift = row.count;
                db.get('SELECT COUNT(*) as count FROM manual_gifts', (err, row) => {
                  stats.manual_gifts = row.count;
                  db.get('SELECT SUM(used_quantity) as used, SUM(available_quantity) as available FROM gift_inventory', (err, row) => {
                    stats.gift_used = row.used || 0;
                    stats.gift_available = row.available || 0;
                    res.json({ success: true, data: stats });
                  });
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
