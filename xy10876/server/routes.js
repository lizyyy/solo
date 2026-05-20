const express = require('express');
const router = express.Router();
const service = require('./service');

const asyncHandler = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  });
};

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

router.post('/payments', asyncHandler(async (req, res) => {
  const { orderNo, amount, channel } = req.body;
  const paymentId = await service.createPayment(orderNo, amount, channel);
  res.json({ success: true, paymentId });
}));

router.post('/refunds', asyncHandler(async (req, res) => {
  const { paymentOrderNo, amount, reason, operator } = req.body;
  const result = await service.createRefund(paymentOrderNo, amount, reason, operator);
  res.json({ success: true, ...result });
}));

router.get('/refunds', asyncHandler(async (req, res) => {
  const result = await service.searchRefunds(req.query);
  res.json({ success: true, data: result });
}));

router.get('/refunds/:id', asyncHandler(async (req, res) => {
  const result = await service.getRefundDetail(req.params.id);
  if (!result) {
    return res.status(404).json({ success: false, error: '退款单不存在' });
  }
  res.json({ success: true, data: result });
}));

router.post('/refunds/:id/submit', asyncHandler(async (req, res) => {
  const { operator } = req.body;
  const result = await service.submitToChannel(req.params.id, operator);
  res.json({ success: true, ...result });
}));

router.post('/refunds/:id/query', asyncHandler(async (req, res) => {
  const { operator } = req.body;
  const result = await service.queryChannelStatus(req.params.id, operator);
  res.json({ success: true, ...result });
}));

router.post('/refunds/:id/review', asyncHandler(async (req, res) => {
  const { reviewer, comment, decision } = req.body;
  const result = await service.manualReview(req.params.id, reviewer, comment, decision);
  res.json({ success: true, ...result });
}));

router.post('/refunds/:id/archive', asyncHandler(async (req, res) => {
  const { operator } = req.body;
  const result = await service.archiveReceipt(req.params.id, operator);
  res.json({ success: true, ...result });
}));

router.post('/refunds/:id/fix', asyncHandler(async (req, res) => {
  const { newStatus, operator } = req.body;
  const result = await service.fixDirtyData(req.params.id, newStatus, operator);
  res.json({ success: true, refund: result });
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  const result = await service.getAllLogs(limit);
  res.json({ success: true, data: result });
}));

router.get('/export/:type', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await service.exportData(req.params.type, startDate, endDate);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-export.json"`);
  res.json({ success: true, ...result });
}));

router.get('/statuses', (req, res) => {
  res.json({
    success: true,
    refundStatuses: service.REFUND_STATUS,
    channelStatuses: service.CHANNEL_STATUS
  });
});

module.exports = router;
