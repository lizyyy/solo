const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');
const store = require('../data/store');

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const idempotencyKey = req.headers['x-idempotency-key'];
    const result = pickupService.pickup(req.body, idempotencyKey, operator);
    
    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      data: result,
      message: result.isDuplicate ? '重复请求，返回上次结果' : '接送成功'
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error.message,
      authorized: error.authorized,
      validation: error.validation,
      exception: error.exception
    });
  }
});

router.get('/', (req, res) => {
  try {
    const childId = req.query.childId;
    const date = req.query.date;
    let pickups = Array.from(store.pickups.values());
    
    if (childId) {
      pickups = pickups.filter(p => p.childId === childId);
    }
    
    if (date) {
      pickups = pickups.filter(p => p.pickupTime.startsWith(date));
    }
    
    res.json({
      success: true,
      data: pickups.sort((a, b) => new Date(b.pickupTime) - new Date(a.pickupTime))
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
