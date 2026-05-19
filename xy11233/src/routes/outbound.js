const express = require('express');
const router = express.Router();
const outboundService = require('../services/outboundService');
const logger = require('../config/logger');

const SYSTEM_OPERATOR = {
  id: 1,
  name: 'System',
  role: 'admin'
};

router.post('/', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await outboundService.processOutbound(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('出库失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await outboundService.getOutboundRecords(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取出库记录失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/available/:reagentId', async (req, res) => {
  try {
    const result = await outboundService.getAvailableInventory(req.params.reagentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取可用库存失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
