const express = require('express');
const router = express.Router();
const { all } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { booking_id, action, limit = 100 } = req.query;
    let sql = `
      SELECT a.*, b.customer_name, b.studio, b.booking_date
      FROM audit_logs a
      LEFT JOIN bookings b ON a.booking_id = b.id
      WHERE 1=1
    `;
    let params = [];

    if (booking_id) {
      sql += ' AND a.booking_id = ?';
      params.push(booking_id);
    }

    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await all(sql, params);
    res.json(logs);
  } catch (error) {
    console.error('获取审计流水失败:', error);
    res.status(500).json({ error: '获取审计流水失败' });
  }
});

module.exports = router;
