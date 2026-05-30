const express = require('express');
const router = express.Router();

const importService = require('../services/importService');
const queryService = require('../services/queryService');
const stateMachine = require('../services/stateMachine');
const anomalyDetector = require('../services/anomalyDetector');
const expenseAllocator = require('../services/expenseAllocator');
const reportService = require('../services/reportService');
const config = require('../config');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'band-rental-settlement',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/config', (req, res) => {
  res.json({
    states: config.states,
    rental: config.rental,
    allocationTypes: expenseAllocator.ALLOCATION_TYPES,
    anomalyTypes: anomalyDetector.ANOMALY_TYPES,
    reportTypes: reportService.REPORT_TYPES
  });
});

router.get('/statistics', asyncHandler(async (req, res) => {
  const stats = await queryService.getStatistics(req.query);
  res.json({ success: true, data: stats });
}));

router.post('/import/members', asyncHandler(async (req, res) => {
  try {
    const { members, options } = req.body;
    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ success: false, error: 'members array is required' });
    }
    const result = await importService.importMembers(members, options || {});
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}));

router.post('/import/equipment', asyncHandler(async (req, res) => {
  try {
    const { equipment, options } = req.body;
    if (!equipment || !Array.isArray(equipment)) {
      return res.status(400).json({ success: false, error: 'equipment array is required' });
    }
    const result = await importService.importEquipment(equipment, options || {});
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}));

router.post('/import/orders', asyncHandler(async (req, res) => {
  try {
    const { orders, options } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, error: 'orders array is required' });
    }
    const result = await importService.importRentalOrders(orders, options || {});
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}));

router.get('/batches', asyncHandler(async (req, res) => {
  const { type } = req.query;
  const batches = await importService.listBatches(type);
  res.json({ success: true, data: batches });
}));

router.get('/batches/:batchId', asyncHandler(async (req, res) => {
  const info = await importService.getBatchInfo(req.params.batchId);
  if (!info) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  res.json({ success: true, data: info });
}));

router.get('/members', asyncHandler(async (req, res) => {
  const members = await queryService.getMemberList(req.query);
  res.json({ success: true, data: members });
}));

router.get('/equipment', asyncHandler(async (req, res) => {
  const equipment = await queryService.getEquipmentList(req.query);
  res.json({ success: true, data: equipment });
}));

router.get('/equipment/:equipmentId/usage', asyncHandler(async (req, res) => {
  const history = await queryService.getEquipmentUsageHistory(req.params.equipmentId, req.query);
  res.json({ success: true, data: history });
}));

router.get('/members/:memberId/usage', asyncHandler(async (req, res) => {
  const history = await queryService.getMemberUsageHistory(req.params.memberId, req.query);
  res.json({ success: true, data: history });
}));

router.get('/members/:memberId/allocations', asyncHandler(async (req, res) => {
  const allocations = await expenseAllocator.getMemberAllocations(req.params.memberId, req.query.order_id);
  res.json({ success: true, data: allocations });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await queryService.getRentalOrderList(req.query);
  res.json({ success: true, data: orders });
}));

router.get('/orders/:orderId', asyncHandler(async (req, res) => {
  const detail = await queryService.getRentalOrderDetail(req.params.orderId);
  if (!detail) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, data: detail });
}));

router.get('/orders/:orderId/trace', asyncHandler(async (req, res) => {
  const trace = await queryService.getOrderTrace(req.params.orderId);
  if (!trace) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, data: trace });
}));

router.get('/orders/:orderId/allocation-summary', asyncHandler(async (req, res) => {
  const summary = await expenseAllocator.getAllocationSummary(req.params.orderId);
  res.json({ success: true, data: summary });
}));

router.post('/orders/:orderId/allocate', asyncHandler(async (req, res) => {
  try {
    const result = await expenseAllocator.runAllocation(req.params.orderId, req.body || {});
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}));

router.post('/orders/:orderId/transition', asyncHandler(async (req, res) => {
  try {
    const { to_state, reason, operator } = req.body;
    if (!to_state) {
      return res.status(400).json({ success: false, error: 'to_state is required' });
    }
    const result = await stateMachine.transitionRentalOrder(
      req.params.orderId, 
      to_state, 
      reason, 
      operator
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message, code: e.name });
  }
}));

router.get('/allocations/:allocationId/trace', asyncHandler(async (req, res) => {
  const trace = await expenseAllocator.getAllocationsWithTrace(req.params.allocationId);
  if (!trace) {
    return res.status(404).json({ success: false, error: 'Allocation not found' });
  }
  res.json({ success: true, data: trace });
}));

router.get('/deposits', asyncHandler(async (req, res) => {
  const deposits = await queryService.getDepositList(req.query);
  res.json({ success: true, data: deposits });
}));

router.post('/deposits/:depositId/transition', asyncHandler(async (req, res) => {
  try {
    const { to_state, reason, operator, refund_amount, deduct_amount } = req.body;
    if (!to_state) {
      return res.status(400).json({ success: false, error: 'to_state is required' });
    }
    const result = await stateMachine.transitionDeposit(
      req.params.depositId,
      to_state,
      reason,
      operator,
      refund_amount || 0,
      deduct_amount || 0
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message, code: e.name });
  }
}));

router.post('/equipment/:equipmentId/transition', asyncHandler(async (req, res) => {
  try {
    const { to_state, reason, operator } = req.body;
    if (!to_state) {
      return res.status(400).json({ success: false, error: 'to_state is required' });
    }
    const result = await stateMachine.transitionEquipment(
      req.params.equipmentId,
      to_state,
      reason,
      operator
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message, code: e.name });
  }
}));

router.get('/state-history/:entityType/:entityId', asyncHandler(async (req, res) => {
  const history = await stateMachine.getStateHistory(req.params.entityType, req.params.entityId);
  res.json({ success: true, data: history });
}));

router.get('/valid-transitions/:entityType/:currentState', (req, res) => {
  const transitions = stateMachine.getValidTransitions(
    req.params.entityType,
    req.params.currentState
  );
  res.json({ success: true, data: transitions });
});

router.get('/anomalies', asyncHandler(async (req, res) => {
  const anomalies = await anomalyDetector.getAnomalies(req.query);
  res.json({ success: true, data: anomalies });
}));

router.post('/anomalies/check', asyncHandler(async (req, res) => {
  const result = await anomalyDetector.runAllChecks();
  res.json({ success: true, data: result });
}));

router.post('/anomalies/:anomalyId/resolve', asyncHandler(async (req, res) => {
  try {
    const { resolution_notes, operator } = req.body;
    const result = await anomalyDetector.resolveAnomaly(
      req.params.anomalyId,
      resolution_notes,
      operator
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}));

router.post('/anomalies/resolve-by-type/:type', asyncHandler(async (req, res) => {
  try {
    const { resolution_notes, operator } = req.body;
    const result = await anomalyDetector.resolveAnomaliesByType(
      req.params.type,
      resolution_notes,
      operator
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}));

router.post('/reports/settlement/:orderId', asyncHandler(async (req, res) => {
  const batchId = reportService.generateBatchId('RPT');
  const result = await reportService.generateSettlementReport(req.params.orderId, batchId);
  res.json({ success: true, data: result });
}));

router.post('/reports/member-bill/:memberId', asyncHandler(async (req, res) => {
  const batchId = reportService.generateBatchId('RPT');
  const result = await reportService.generateMemberBillReport(
    req.params.memberId, 
    batchId, 
    req.query || {}
  );
  res.json({ success: true, data: result });
}));

router.post('/reports/deposit-tracking', asyncHandler(async (req, res) => {
  const batchId = reportService.generateBatchId('RPT');
  const result = await reportService.generateDepositTrackingReport(batchId, req.query || {});
  res.json({ success: true, data: result });
}));

router.post('/reports/anomaly', asyncHandler(async (req, res) => {
  const batchId = reportService.generateBatchId('RPT');
  const result = await reportService.generateAnomalyReport(batchId, req.query || {});
  res.json({ success: true, data: result });
}));

router.get('/reports', (req, res) => {
  const reports = reportService.listReports();
  res.json({ success: true, data: reports });
});

router.get('/reports/:fileName/download', (req, res) => {
  const filePath = reportService.getReportFilePath(req.params.fileName);
  if (!filePath) {
    return res.status(404).json({ success: false, error: 'Report not found' });
  }
  res.download(filePath, req.params.fileName);
});

router.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = router;
