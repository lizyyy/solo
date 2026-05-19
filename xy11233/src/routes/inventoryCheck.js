const express = require('express');
const router = express.Router();
const inventoryCheckService = require('../services/inventoryCheckService');
const logger = require('../config/logger');

const SYSTEM_OPERATOR = {
  id: 1,
  name: 'System',
  role: 'admin'
};

router.post('/', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await inventoryCheckService.createCheck(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('创建盘点单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await inventoryCheckService.startCheck(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('开始盘点失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/item', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await inventoryCheckService.updateCheckItem(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('更新盘点项失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await inventoryCheckService.completeCheck(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('完成盘点失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await inventoryCheckService.getCheckDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '盘点单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取盘点单详情失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await inventoryCheckService.listChecks(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取盘点单列表失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
