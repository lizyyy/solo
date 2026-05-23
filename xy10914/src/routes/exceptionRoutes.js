const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exceptionService');
const reassignmentService = require('../services/reassignmentService');
const evidenceService = require('../services/evidenceService');
const arbitrationService = require('../services/arbitrationService');
const exportService = require('../services/exportService');
const baseService = require('../services/baseService');

router.post('/exceptions', async (req, res) => {
  try {
    const { orderId, riderId, exceptionTypeId, description } = req.body;
    const result = await exceptionService.createExceptionRecord(
      orderId, riderId, exceptionTypeId, description, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await exceptionService.queryExceptionRecords(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions/:id', async (req, res) => {
  try {
    const result = await exceptionService.getExceptionDetail(req.params.id);
    if (!result.exception) {
      return res.status(404).json({ success: false, error: '异常单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/exceptions/:id/status', async (req, res) => {
  try {
    const { status, operator } = req.body;
    const result = await exceptionService.updateExceptionStatus(
      req.params.id, status, operator, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exceptions/:id/reassignments', async (req, res) => {
  try {
    const { fromRiderId, reason } = req.body;
    const result = await reassignmentService.createReassignment(
      req.params.id, fromRiderId, reason, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/reassignments/:id/process', async (req, res) => {
  try {
    const { toRiderId, status, processedBy, conclusion } = req.body;
    const result = await reassignmentService.processReassignment(
      req.params.id, toRiderId, status, processedBy, conclusion, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reassignments', async (req, res) => {
  try {
    const result = await reassignmentService.queryReassignments(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exceptions/:id/evidences', async (req, res) => {
  try {
    const { uploaderId, evidenceType, evidenceUrl, description } = req.body;
    const result = await evidenceService.uploadEvidence(
      req.params.id, uploaderId, evidenceType, evidenceUrl, description, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/evidences/:id/verify', async (req, res) => {
  try {
    const { verified, verifiedBy } = req.body;
    const result = await evidenceService.verifyEvidence(
      req.params.id, verified, verifiedBy, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/evidences', async (req, res) => {
  try {
    const result = await evidenceService.queryEvidences(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exceptions/:id/arbitrations', async (req, res) => {
  try {
    const { arbitrator, result, conclusion, penaltyType, penaltyAmount } = req.body;
    const arbitrationResult = await arbitrationService.createArbitration(
      req.params.id, arbitrator, result, conclusion, penaltyType, penaltyAmount, req.body
    );
    res.json({ success: true, data: arbitrationResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/arbitrations/:id/finalize', async (req, res) => {
  try {
    const { arbitrator } = req.body;
    const result = await arbitrationService.finalizeArbitration(
      req.params.id, arbitrator, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/arbitrations', async (req, res) => {
  try {
    const result = await arbitrationService.queryArbitrations(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/exceptions/:id/correct', async (req, res) => {
  try {
    const { operator, correctionReason, newStatus } = req.body;
    const result = await arbitrationService.manualCorrection(
      req.params.id, operator, correctionReason, newStatus, req.body
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/exceptions', async (req, res) => {
  try {
    const result = await exportService.exportExceptionRecords(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=exceptions.csv');
    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/arbitrations', async (req, res) => {
  try {
    const result = await exportService.exportArbitrationResults(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=arbitrations.csv');
    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/riders', async (req, res) => {
  try {
    const result = await baseService.getAllRiders();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const result = await baseService.getAllOrders();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exception-types', async (req, res) => {
  try {
    const result = await baseService.getAllExceptionTypes();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
