const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const VerifyService = require('../services/VerifyService');
const { maskData } = require('../utils/mask');

router.post('/visitor', async (req, res) => {
  try {
    const { phone, gateNumber, checkDate } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: '请提供手机号码' });
    }
    
    const result = await VerifyService.verifyVisitor(phone, {
      gateNumber,
      verifyBy: req.user?.username || 'system',
      checkDate
    });
    
    const isAdmin = req.user?.role === 'admin';
    
    res.json({
      success: true,
      data: {
        isAllowed: result.isAllowed,
        isInBlacklist: result.isInBlacklist,
        blacklistLevel: result.blacklistLevel,
        verifyResult: result.verifyResult,
        visitors: isAdmin ? result.visitors : maskData(result.visitors)
      }
    });
  } catch (error) {
    logger.error('Verify visitor error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/license-plate', async (req, res) => {
  try {
    const { plateNumber, gateNumber, checkDate } = req.body;
    
    if (!plateNumber) {
      return res.status(400).json({ error: '请提供车牌号码' });
    }
    
    const result = await VerifyService.verifyLicensePlate(plateNumber, {
      gateNumber,
      verifyBy: req.user?.username || 'system',
      checkDate
    });
    
    const isAdmin = req.user?.role === 'admin';
    
    res.json({
      success: true,
      data: {
        isAllowed: result.isAllowed,
        isInBlacklist: result.isInBlacklist,
        blacklistLevel: result.blacklistLevel,
        verifyResult: result.verifyResult,
        temporaryPlate: isAdmin ? result.temporaryPlate : maskData(result.temporaryPlate)
      }
    });
  } catch (error) {
    logger.error('Verify plate error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/id-card', async (req, res) => {
  try {
    const { idCard, gateNumber } = req.body;
    
    if (!idCard) {
      return res.status(400).json({ error: '请提供身份证号码' });
    }
    
    const result = await VerifyService.verifyByIdCard(idCard, {
      gateNumber,
      verifyBy: req.user?.username || 'system'
    });
    
    res.json({
      success: true,
      data: {
        isAllowed: result.isAllowed,
        isInBlacklist: result.isInBlacklist,
        blacklistLevel: result.blacklistLevel,
        verifyResult: result.verifyResult
      }
    });
  } catch (error) {
    logger.error('Verify id card error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const filters = {
      verifyType: req.query.type,
      isAllowed: req.query.isAllowed ? req.query.isAllowed === 'true' : undefined,
      isInBlacklist: req.query.isInBlacklist ? req.query.isInBlacklist === 'true' : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const records = await VerifyService.getVerifyHistory(filters);
    
    const isAdmin = req.user?.role === 'admin';
    const maskedRecords = isAdmin ? records : records.map(record => ({
      ...record,
      target_value: maskTargetValue(record.target_value, record.verify_type)
    }));
    
    res.json({ success: true, data: maskedRecords });
  } catch (error) {
    logger.error('Get verify history error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await VerifyService.getStatistics(req.query.date);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Get statistics error:', error);
    res.status(500).json({ error: error.message });
  }
});

function maskTargetValue(value, type) {
  if (!value) return value;
  
  switch (type) {
    case 'visitor':
    case 'id_card':
      return value.length > 7 ? value.slice(0, 3) + '****' + value.slice(-4) : value;
    case 'license_plate':
      return value.length > 4 ? value.slice(0, 2) + '***' + value.slice(-2) : value;
    default:
      return value;
  }
}

module.exports = router;
