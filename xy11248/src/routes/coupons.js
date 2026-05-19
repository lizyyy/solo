const express = require('express');
const router = express.Router();
const db = require('../database');
const compensationService = require('../services/compensationService');

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM coupons WHERE 1=1';
    const params = [];

    if (req.query.user_id) {
      sql += ' AND user_id = ?';
      params.push(req.query.user_id);
    }

    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY created_at DESC';

    const coupons = await db.all(sql, params);
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expire', async (req, res) => {
  try {
    const result = await compensationService.expireCoupons();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const coupon = await db.get('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
    if (!coupon) {
      return res.status(404).json({ error: '优惠券不存在' });
    }
    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
