const express = require('express');
const db = require('../database');

const router = express.Router();

const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  WAITING_PARTS: 'waiting_parts',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

router.get('/stats', (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const promises = [];

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE status = ?
      `, [STATUS.PENDING], (err, row) => {
        if (err) return reject(err);
        resolve({ status: 'pending', count: row.count, label: '待接单' });
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE status = ?
      `, [STATUS.IN_PROGRESS], (err, row) => {
        if (err) return reject(err);
        resolve({ status: 'in_progress', count: row.count, label: '维修中' });
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE status = ?
      `, [STATUS.WAITING_PARTS], (err, row) => {
        if (err) return reject(err);
        resolve({ status: 'waiting_parts', count: row.count, label: '等待备件' });
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE status = ?
      `, [STATUS.COMPLETED], (err, row) => {
        if (err) return reject(err);
        resolve({ status: 'completed', count: row.count, label: '已完成' });
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM spare_parts 
        WHERE stock <= safe_stock 
        ORDER BY stock ASC
      `, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE date(created_at) = ?
      `, [todayStr], (err, row) => {
        if (err) return reject(err);
        resolve(row.count);
      });
    })
  );

  promises.push(
    new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count FROM work_orders 
        WHERE date(created_at) = ? AND status = ?
      `, [todayStr, STATUS.COMPLETED], (err, row) => {
        if (err) return reject(err);
        resolve(row.count);
      });
    })
  );

  Promise.all(promises)
    .then((results) => {
      const [pending, inProgress, waitingParts, completed, lowStockParts, todayCreated, todayCompleted] = results;
      
      res.json({
        data: {
          work_order_stats: {
            pending,
            in_progress: inProgress,
            waiting_parts: waitingParts,
            completed
          },
          today_stats: {
            created: todayCreated,
            completed: todayCompleted
          },
          low_stock_parts: lowStockParts
        }
      });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

module.exports = router;
