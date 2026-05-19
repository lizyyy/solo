const express = require('express');
const router = express.Router();
const VerificationService = require('../services/verificationService');
const { OperationLogger } = require('../utils/logger');

router.post('/phone', async (req, res) => {
  try {
    const { phone, gate } = req.body;
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    if (!phone) {
      return res.status(400).json({ success: false, error: '手机号不能为空' });
    }
    
    const result = await VerificationService.verifyByPhone(phone, gate, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/plate', async (req, res) => {
  try {
    const { plate_number, gate } = req.body;
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    if (!plate_number) {
      return res.status(400).json({ success: false, error: '车牌号不能为空' });
    }
    
    const result = await VerificationService.verifyByPlate(plate_number, gate, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.post('/force-allow', async (req, res) => {
  try {
    const { verify_type, identifier, reason, gate } = req.body;
    const operator = {
      id: req.user?.id || 1,
      name: req.user?.name || 'admin'
    };
    
    if (!verify_type || !identifier || !reason) {
      return res.status(400).json({ success: false, error: '参数不完整' });
    }
    
    const result = await VerificationService.forceAllow(verify_type, identifier, reason, gate, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await VerificationService.getStatistics(start_date, end_date);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/records', async (req, res) => {
  try {
    const options = {
      verifyType: req.query.verify_type,
      result: req.query.result,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    
    const records = await OperationLogger.getVerificationRecords(options);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const records = await VerificationService.getRecentVerifications(limit);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
