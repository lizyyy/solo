const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { ROLES, ROLE_PERMISSIONS, maskSensitiveFields } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    db.all(`
      SELECT 
        u.id,
        u.username,
        u.real_name,
        u.phone,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      const maskedData = rows.map(row => maskSensitiveFields(row, req.headers['x-user-role'] || 'unknown'));
      res.json({ success: true, data: maskedData });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    db.get(`
      SELECT 
        u.id,
        u.username,
        u.real_name,
        u.phone,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      if (!row) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }

      const maskedData = maskSensitiveFields(row, req.headers['x-user-role'] || 'unknown');
      res.json({ success: true, data: maskedData });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误', error: error.message });
  }
});

module.exports = router;
