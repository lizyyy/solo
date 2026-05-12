const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');
const store = require('../data/store');

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const idempotencyKey = req.headers['x-idempotency-key'];
    const result = pickupService.checkIn(req.body, idempotencyKey, operator);
    
    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      data: result,
      message: result.isDuplicate ? '重复请求，返回上次结果' : '签到成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      exception: error.exception
    });
  }
});

router.get('/', (req, res) => {
  try {
    const childId = req.query.childId;
    const date = req.query.date;
    let checkIns = Array.from(store.checkIns.values());
    
    if (childId) {
      checkIns = checkIns.filter(ci => ci.childId === childId);
    }
    
    if (date) {
      checkIns = checkIns.filter(ci => ci.checkInTime.startsWith(date));
    }
    
    res.json({
      success: true,
      data: checkIns.sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
