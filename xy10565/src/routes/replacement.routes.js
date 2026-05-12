const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const ReplacementService = require('../services/ReplacementService');
const FaultAuditService = require('../services/FaultAuditService');
const InventoryService = require('../services/InventoryService');
const ShipmentService = require('../services/ShipmentService');
const RecycleService = require('../services/RecycleService');
const WarrantyService = require('../services/WarrantyService');
const OperationLogService = require('../services/OperationLogService');
const StatusHistoryService = require('../services/StatusHistoryService');

const getOperator = (req) => req.header('X-Operator') || 'SYSTEM';

router.post('/', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = await ReplacementService.createApplication(req.body, operator);
  
  res.status(result.isDuplicate ? 200 : 201).json({
    success: true,
    data: result
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const filter = {
    status: req.query.status,
    customer_id: req.query.customer_id,
    application_no: req.query.application_no
  };
  
  const applications = await ReplacementService.listApplications(filter);
  
  res.json({
    success: true,
    data: applications
  });
}));

router.get('/statistics', asyncHandler(async (req, res) => {
  const stats = ReplacementService.getStatistics();
  
  res.json({
    success: true,
    data: stats
  });
}));

router.get('/risk-report', asyncHandler(async (req, res) => {
  const report = ReplacementService.getRiskReport();
  
  res.json({
    success: true,
    data: report
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const detail = ReplacementService.getApplicationDetail(req.params.id);
  
  res.json({
    success: true,
    data: detail
  });
}));

router.get('/:id/relation', asyncHandler(async (req, res) => {
  const report = ReplacementService.getDeviceRelationReport(req.params.id);
  
  res.json({
    success: true,
    data: report
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = ReplacementService.cancelApplication(req.params.id, operator, req.body?.reason);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/fault-audit', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = FaultAuditService.submitFaultAudit(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/fault-audit/start', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = FaultAuditService.startFaultAudit(req.params.id, operator);
  
  res.json({
    success: true,
    data: { application: result }
  });
}));

router.post('/:id/inventory-allocate', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = InventoryService.allocateInventory(req.params.id, operator);
  
  if (result.inventory_shortage) {
    res.status(422).json({
      success: false,
      error: {
        code: 'INVENTORY_SHORTAGE',
        message: result.message
      },
      data: result
    });
  } else {
    res.json({
      success: true,
      data: result
    });
  }
}));

router.post('/:id/inventory-check', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = InventoryService.startInventoryCheck(req.params.id, operator);
  
  res.json({
    success: true,
    data: { application: result }
  });
}));

router.post('/:id/shipment', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = ShipmentService.createShipment(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/shipment/start', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = ShipmentService.startShipping(req.params.id, operator);
  
  res.json({
    success: true,
    data: { application: result }
  });
}));

router.post('/:id/shipment/delivered', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = ShipmentService.confirmDelivery(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/recycle/start', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = RecycleService.startRecycleProcess(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/recycle/receive', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = RecycleService.confirmReceive(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/recycle/complete', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = RecycleService.completeInspection(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/warranty', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = WarrantyService.recalculateWarranty(req.params.id, req.body, operator);
  
  res.json({
    success: true,
    data: result
  });
}));

router.post('/:id/warranty/start', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const result = WarrantyService.startWarrantyCalculation(req.params.id, operator);
  
  res.json({
    success: true,
    data: { application: result }
  });
}));

router.post('/:id/warranty/extend', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const { extend_days, reason } = req.body;
  const result = WarrantyService.manualExtendWarranty(req.params.id, extend_days, operator, reason);
  
  res.json({
    success: true,
    data: result
  });
}));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const history = StatusHistoryService.getHistory(req.params.id);
  
  res.json({
    success: true,
    data: history
  });
}));

router.get('/:id/logs', asyncHandler(async (req, res) => {
  const logs = OperationLogService.getLogsByApplication(req.params.id);
  
  res.json({
    success: true,
    data: logs
  });
}));

router.post('/:id/correct', asyncHandler(async (req, res) => {
  const operator = getOperator(req);
  const { module, reason, ...corrections } = req.body;
  
  const detail = ReplacementService.getApplicationDetail(req.params.id);
  
  OperationLogService.recordManualCorrection(
    req.params.id,
    module || 'MANUAL',
    operator,
    { application: detail.application },
    { application: { ...detail.application, ...corrections } },
    reason || '人工修正'
  );
  
  res.json({
    success: true,
    message: '人工修正操作已记录',
    data: {
      operator,
      module: module || 'MANUAL',
      reason: reason || '人工修正',
      corrections
    }
  });
}));

module.exports = router;
