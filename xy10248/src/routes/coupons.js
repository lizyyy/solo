const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.post('/', (req, res) => {
  const { userId, amount, validDays, claimNo, orderNo, idempotencyKey } = req.body;
  
  if (!userId || !amount) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: '缺少必要参数' });
  }
  
  const result = db.issueCoupon(userId, amount, validDays || 30, claimNo, orderNo, idempotencyKey);
  
  if (result.duplicate) {
    return res.status(200).json({
      ...result,
      message: '重复请求，返回已有优惠券'
    });
  }
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.status(201).json(result);
});

router.get('/', (req, res) => {
  const { userId, claimNo } = req.query;
  let coupons;
  
  if (userId) {
    coupons = db.getCouponsByUser(userId);
  } else if (claimNo) {
    coupons = db.getCouponsByClaim(claimNo);
  } else {
    coupons = [...db.db.coupons];
  }
  
  res.json({ coupons });
});

router.get('/:couponNo', (req, res) => {
  const coupon = db.getCoupon(req.params.couponNo);
  if (!coupon) {
    return res.status(404).json({ error: 'COUPON_NOT_FOUND', message: '优惠券不存在' });
  }
  res.json({ coupon });
});

module.exports = router;
