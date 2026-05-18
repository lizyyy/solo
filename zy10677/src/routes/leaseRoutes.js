const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const service = require('../services/depositService');
const { createDeposit } = require('../models/store');

router.post('/', (req, res) => {
  try {
    const lease = service.createLease(req.body);
    createDeposit(lease.id, req.body.depositAmount);
    res.status(201).json({
      success: true,
      data: lease
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  const leases = service.getAllLeases();
  res.json({
    success: true,
    data: leases
  });
});

router.get('/:id', (req, res) => {
  const detail = service.getLeaseDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({
      success: false,
      error: '租赁单不存在'
    });
  }
  res.json({
    success: true,
    data: detail
  });
});

router.get('/:id/history', (req, res) => {
  const history = service.getHistoryByEntityId(req.params.id);
  res.json({
    success: true,
    data: history
  });
});

router.post('/:id/start-inspection', (req, res) => {
  const result = service.startInspection(req.params.id, req.body.operator);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:id/refund', (req, res) => {
  const { amount, reason, operator, attachments } = req.body;
  const result = service.processRefund(
    req.params.id,
    amount,
    reason,
    operator,
    attachments
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/refund-batches/:batchId/reject', (req, res) => {
  const result = service.rejectRefund(
    req.params.batchId,
    req.body.reason,
    req.body.operator
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/export/csv', (req, res) => {
  const data = service.exportLeases();
  const parser = new Parser();
  const csv = parser.parse(data);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=leases-${Date.now()}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/export/json', (req, res) => {
  const data = service.exportLeases();
  res.json({
    success: true,
    data
  });
});

router.post('/import', (req, res) => {
  const result = service.importLeases(req.body.data || [], req.body.operator);
  res.json({
    success: true,
    ...result
  });
});

module.exports = router;
