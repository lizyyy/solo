const express = require('express');
const { queryOne } = require('../utils/db');
const { success, error, handleAsync } = require('../utils/response');
const {
  PAYMENT_TRIGGER_TYPES,
  getMilestonePaymentStatus,
  checkPaymentTrigger,
  approvePayment,
  confirmPayment,
  getPaymentHistory,
  getPaymentTriggerLogs
} = require('../utils/payment-service');

const router = express.Router();

router.get('/trigger-types', handleAsync(async (req, res) => {
  const types = [
    { value: PAYMENT_TRIGGER_TYPES.ALL_ACCEPTED, label: '所有交付物验收通过且无待处理返工（推荐）', description: '默认触发条件，确保交付质量' },
    { value: PAYMENT_TRIGGER_TYPES.NO_REWORK_PENDING, label: '无待处理返工', description: '只要没有待处理的返工任务即可触发' },
    { value: PAYMENT_TRIGGER_TYPES.PERCENTAGE_ACCEPTED, label: '按验收通过率触发', description: '可设置达到一定百分比即可触发' },
    { value: PAYMENT_TRIGGER_TYPES.SPECIFIC_DELIVERABLES, label: '指定交付物验收通过', description: '只要求特定的交付物通过验收' },
    { value: PAYMENT_TRIGGER_TYPES.MANUAL, label: '手动审批', description: '完全手动控制付款审批' }
  ];
  
  res.json(success(types));
}));

router.get('/milestone/:milestoneId/status', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const paymentStatus = getMilestonePaymentStatus(milestoneId);
  const triggerResult = checkPaymentTrigger(milestone);
  
  res.json(success({
    milestone,
    payment_status: paymentStatus,
    trigger_result: triggerResult
  }));
}));

router.get('/milestone/:milestoneId/history', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const history = getPaymentHistory(milestoneId);
  
  res.json(success(history));
}));

router.get('/milestone/:milestoneId/logs', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const logs = getPaymentTriggerLogs(milestoneId);
  
  res.json(success(logs));
}));

router.post('/milestone/:milestoneId/approve', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  const { operator, reason } = req.body;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const result = approvePayment(milestoneId, operator, reason);
  
  if (result.success) {
    res.json(success(result, result.message));
  } else {
    res.status(400).json(error(result.message, 400));
  }
}));

router.post('/milestone/:milestoneId/confirm', handleAsync(async (req, res) => {
  const { milestoneId } = req.params;
  const { operator, reason } = req.body;
  
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) {
    return res.status(404).json(error('里程碑不存在', 404));
  }
  
  const result = confirmPayment(milestoneId, operator, reason);
  
  if (result.success) {
    res.json(success(result, result.message));
  } else {
    res.status(400).json(error(result.message, 400));
  }
}));

module.exports = router;
