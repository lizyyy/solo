const express = require('express');
const router = express.Router();
const {
  createExceptionShipment,
  getShipmentDetail,
  getAllShipments,
  uploadEvidence,
  judgeLiability,
  calculateShipmentCompensation,
  submitForReview,
  reviewShipment,
  submitAppeal,
  processAppeal,
  completeShipment,
  manualEditShipment,
  processCallback,
  getStatistics
} = require('../services/shipmentService');
const { formatHistoryForDisplay } = require('../services/history');

router.post('/', (req, res) => {
  const result = createExceptionShipment(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/', (req, res) => {
  const filters = {
    status: req.query.status,
    type: req.query.type,
    customerLevel: req.query.customerLevel,
    waybillId: req.query.waybillId
  };
  
  const shipments = getAllShipments(filters);
  res.json({
    success: true,
    data: shipments,
    filters
  });
});

router.get('/statistics', (req, res) => {
  const stats = getStatistics();
  res.json({
    success: true,
    data: stats
  });
});

router.get('/:shipmentId', (req, res) => {
  const detail = getShipmentDetail(req.params.shipmentId);
  if (!detail) {
    return res.status(404).json({
      success: false,
      error: '异常件不存在'
    });
  }
  res.json({
    success: true,
    data: {
      shipment: detail.shipment,
      waybill: detail.waybill,
      trackingSummary: detail.trackingSummary,
      evidences: detail.evidences,
      liability: detail.liability,
      compensation: detail.compensation,
      latestReview: detail.latestReview,
      latestAppeal: detail.latestAppeal,
      history: formatHistoryForDisplay(detail.history),
      nextPossibleStatuses: detail.nextPossibleStatuses
    }
  });
});

router.post('/:shipmentId/evidence', (req, res) => {
  const { operator } = req.query;
  const result = uploadEvidence(req.params.shipmentId, req.body, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/liability', (req, res) => {
  const { operator } = req.query;
  const result = judgeLiability(req.params.shipmentId, req.body, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/calculate', (req, res) => {
  const { operator } = req.query;
  const result = calculateShipmentCompensation(req.params.shipmentId, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/review/submit', (req, res) => {
  const { operator } = req.query;
  const result = submitForReview(req.params.shipmentId, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/review', (req, res) => {
  const { operator } = req.query;
  const result = reviewShipment(req.params.shipmentId, req.body, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/appeal', (req, res) => {
  const { operator } = req.query;
  const result = submitAppeal(req.params.shipmentId, req.body, operator || 'customer');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/appeal/process', (req, res) => {
  const { operator } = req.query;
  const result = processAppeal(req.params.shipmentId, req.body, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/complete', (req, res) => {
  const { operator } = req.query;
  const result = completeShipment(req.params.shipmentId, operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/edit', (req, res) => {
  const { operator } = req.query;
  const { changes, reason } = req.body;
  
  if (!changes) {
    return res.status(400).json({
      success: false,
      error: '缺少 changes 字段'
    });
  }
  
  const result = manualEditShipment(req.params.shipmentId, changes, reason || '', operator || 'system');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:shipmentId/callback', (req, res) => {
  const result = processCallback(req.params.shipmentId, req.body);
  if (!result.success && !result.idempotent) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/:shipmentId/history', (req, res) => {
  const detail = getShipmentDetail(req.params.shipmentId);
  if (!detail) {
    return res.status(404).json({
      success: false,
      error: '异常件不存在'
    });
  }
  res.json({
    success: true,
    data: formatHistoryForDisplay(detail.history)
  });
});

module.exports = router;
