const express = require('express');
const router = express.Router();
const db = require('../database');
router.get('/', (req, res) => {
  const { business_type, business_id } = req.query;
  let sql = 'SELECT * FROM status_history';
  let params = [];
  if (business_type && business_id) {
    sql += ' WHERE business_type = ? AND business_id = ?';
    params = [business_type, business_id];
  } else if (business_type) {
    sql += ' WHERE business_type = ?';
    params = [business_type];
  } else if (business_id) {
    sql += ' WHERE business_id = ?';
    params = [business_id];
  }
  sql += ' ORDER BY created_at DESC';
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: '查询历史记录失败' });
    }
    res.json({ success: true, data: rows });
  });
});
module.exports = router;
