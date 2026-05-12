const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');
const store = require('../data/store');

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const child = pickupService.createChild(req.body, operator);
    res.status(201).json({
      success: true,
      data: child,
      message: '儿童档案创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:childId', (req, res) => {
  try {
    const child = store.children.get(req.params.childId);
    if (!child) {
      return res.status(404).json({
        success: false,
        message: '儿童档案不存在'
      });
    }
    res.json({
      success: true,
      data: child
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:childId/status', (req, res) => {
  try {
    const date = req.query.date;
    const status = pickupService.getChildStatus(req.params.childId, date);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const children = Array.from(store.children.values());
    res.json({
      success: true,
      data: children
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
