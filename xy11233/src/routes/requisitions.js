const express = require('express');
const router = express.Router();
const requisitionService = require('../services/requisitionService');
const logger = require('../config/logger');

const SYSTEM_OPERATOR = {
  id: 1,
  name: 'System',
  role: 'admin'
};

router.post('/', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await requisitionService.createRequisition(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('创建申领单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await requisitionService.submitRequisition(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('提交申领单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await requisitionService.approveRequisition(req.params.id, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('审批申领单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const operator = req.user || SYSTEM_OPERATOR;
    const result = await requisitionService.rejectRequisition(req.params.id, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('驳回申领单失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await requisitionService.getRequisitionDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '申领单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取申领单详情失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await requisitionService.listRequisitions(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取申领单列表失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
