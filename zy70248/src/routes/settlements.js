const express = require('express');
const router = express.Router();
const { service: settlementService } = require('../services/settlementService');
const { handleError } = require('../utils/errors');

router.post('/calculate/:berthingId', (req, res) => {
  try {
    const calculation = settlementService.calculateSettlement(req.params.berthingId);
    res.json({ success: true, data: calculation });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/create/:berthingId', (req, res) => {
  try {
    const settlement = settlementService.createSettlement(req.params.berthingId);
    res.json({ success: true, data: settlement });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', (req, res) => {
  try {
    const settlements = settlementService.getAllSettlements();
    res.json({ success: true, data: settlements });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const settlement = settlementService.getSettlement(req.params.id);
    res.json({ success: true, data: settlement });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const settlement = settlementService.approveSettlement(
      req.params.id,
      req.body.reviewer || 'UNKNOWN'
    );
    res.json({ success: true, data: settlement });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const settlement = settlementService.rejectSettlement(
      req.params.id,
      req.body.reason,
      req.body.reviewer || 'UNKNOWN'
    );
    res.json({ success: true, data: settlement });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:id/pay', (req, res) => {
  try {
    const settlement = settlementService.markAsPaid(
      req.params.id,
      req.body.paymentReference
    );
    res.json({ success: true, data: settlement });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/berthing/:berthingId', (req, res) => {
  try {
    const settlements = settlementService.getSettlementsByBerthing(req.params.berthingId);
    res.json({ success: true, data: settlements });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/reconciliation', (req, res) => {
  try {
    const report = settlementService.generateReconciliationReport(req.body.settlementIds);
    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/reconciliation/:id', (req, res) => {
  try {
    const report = settlementService.getReconciliationReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/reconciliation', (req, res) => {
  try {
    const reports = settlementService.getAllReconciliationReports();
    res.json({ success: true, data: reports });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
