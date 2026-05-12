const express = require('express');
const router = express.Router();
const pickupService = require('../services/pickupService');
const store = require('../data/store');

router.post('/fixed', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const auth = pickupService.createFixedAuthorization(req.body, operator);
    res.status(201).json({
      success: true,
      data: auth,
      message: '固定授权创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/fixed', (req, res) => {
  try {
    const childId = req.query.childId;
    let auths = Array.from(store.authorizers.values());
    
    if (childId) {
      auths = auths.filter(a => a.childId === childId);
    }
    
    res.json({
      success: true,
      data: auths
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/temporary', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const auth = pickupService.createTemporaryAuthorization(req.body, operator);
    res.status(201).json({
      success: true,
      data: auth,
      message: '临时授权创建成功，等待确认'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/temporary/:authId/confirm', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const auth = pickupService.confirmTemporaryAuthorization(req.params.authId, operator);
    res.json({
      success: true,
      data: auth,
      message: '临时授权确认成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/temporary/:authId/reject', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const reason = req.body.reason || '未说明原因';
    const auth = pickupService.rejectTemporaryAuthorization(req.params.authId, reason, operator);
    res.json({
      success: true,
      data: auth,
      message: '临时授权已拒绝'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/temporary', (req, res) => {
  try {
    const childId = req.query.childId;
    const status = req.query.status;
    let auths = Array.from(store.tempAuthorizations.values());
    
    if (childId) {
      auths = auths.filter(a => a.childId === childId);
    }
    
    if (status) {
      auths = auths.filter(a => a.status === status);
    }
    
    res.json({
      success: true,
      data: auths
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
