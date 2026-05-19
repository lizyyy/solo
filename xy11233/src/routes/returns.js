const express = require('express');
const router = express.Router();
const returnService = require('../services/returnService');
const logger = require('../config/logger');

const SYSTEM_OPERATOR = {
  id: 1,
  name: 'System',
  role: 'admin'
};

router.post('/', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await returnService.processReturn(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('归还失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await returnService.getReturnRecords(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取归还记录失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/returnable/:requisitionId', async (req, res) => {
  try {
    const result = await returnService.getReturnableItems(req.params.requisitionId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取可归还项失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
