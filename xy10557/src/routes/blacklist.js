const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');
const store = require('../data/store');

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const item = pickupService.addToBlacklist(req.body, operator);
    res.status(201).json({
      success: true,
      data: item,
      message: '已加入黑名单'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.delete('/:blacklistId', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const reason = req.body.reason || '移除黑名单';
    const item = pickupService.removeFromBlacklist(req.params.blacklistId, reason, operator);
    res.json({
      success: true,
      data: item,
      message: '已从黑名单移除'
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
    const status = req.query.status || 'active';
    let items = Array.from(store.blacklist.values());
    
    if (status) {
      items = items.filter(i => i.status === status);
    }
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
