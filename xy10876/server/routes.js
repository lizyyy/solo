const express = require('express');
const router = express.Router();
const service = require('./service');

const asyncHandler = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  });
};

const getOperator = (req) => {
  return req.body.operator || req.body.reviewer || req.query.operator || 'api_user';
};

router.get('/health', asyncHandler(async (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
}));

router.post('/payments', asyncHandler(async (req, res) => {
  const { orderNo, amount, channel } = req.body;
  const operator = getOperator(req);
  
  try {
    const paymentId = await service.createPayment(orderNo, amount, channel);
    await service.logRequest(
      null, 
      'create_payment', 
      { orderNo, amount, channel }, 
      { success: true, paymentId },
      operator,
      'payment_create_handler'
    );
    res.json({ success: true, paymentId });
  } catch (error) {
    await service.logRequest(
      null, 
      'create_payment_failed', 
      { orderNo, amount, channel }, 
      { success: false, error: error.message },
      operator,
      'payment_create_handler'
    );
    throw error;
  }
}));

router.post('/refunds', asyncHandler(async (req, res) => {
  const { paymentOrderNo, amount, reason, operator } = req.body;
  
  try {
    const result = await service.createRefund(paymentOrderNo, amount, reason, operator);
    res.json({ success: true, ...result });
  } catch (error) {
    await service.logRequest(
      null, 
      'create_refund_failed', 
      { paymentOrderNo, amount, reason }, 
      { success: false, error: error.message },
      operator || 'api_user',
      'refund_create_handler'
    );
    throw error;
  }
}));

router.get('/refunds', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await service.searchRefunds(req.query);
  
  await service.logRequest(
    null, 
    'search_refunds', 
    { query: req.query }, 
    { success: true, count: result.length },
    operator,
    'refund_search_handler'
  );
  
  res.json({ success: true, data: result });
}));

router.get('/refunds/:id', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await service.getRefundDetail(req.params.id);
  
  if (!result) {
    await service.logRequest(
      req.params.id, 
      'get_refund_detail_failed', 
      { id: req.params.id }, 
      { success: false, error: '退款单不存在' },
      operator,
      'refund_detail_handler'
    );
    return res.status(404).json({ success: false, error: '退款单不存在' });
  }
  
  await service.logRequest(
    req.params.id, 
    'get_refund_detail', 
    { id: req.params.id }, 
    { success: true },
    operator,
    'refund_detail_handler'
  );
  
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
  
  try {
    const result = await service.fixDirtyData(req.params.id, newStatus, operator);
    res.json({ success: true, refund: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  const operator = getOperator(req);
  const result = await service.getAllLogs(limit);
  
  await service.logRequest(
    null, 
    'query_logs', 
    { limit }, 
    { success: true, count: result.length },
    operator,
    'logs_query_handler'
  );
  
  res.json({ success: true, data: result });
}));

router.get('/export/:type', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const type = req.params.type;
  const operator = getOperator(req);
  
  try {
    const result = await service.exportData(type, startDate, endDate);
    
    await service.logRequest(
      null, 
      'export_data', 
      { type, startDate, endDate }, 
      { success: true, count: result.count },
      operator,
      'data_export_handler'
    );
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export.json"`);
    res.json({ success: true, ...result });
  } catch (error) {
    await service.logRequest(
      null, 
      'export_data_failed', 
      { type, startDate, endDate }, 
      { success: false, error: error.message },
      operator,
      'data_export_handler'
    );
    throw error;
  }
}));

router.get('/statuses', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  
  await service.logRequest(
    null, 
    'get_statuses', 
    {}, 
    { success: true },
    operator,
    'status_enum_handler'
  );
  
  res.json({
    success: true,
    refundStatuses: service.REFUND_STATUS,
    channelStatuses: service.CHANNEL_STATUS
  });
}));

module.exports = router;
