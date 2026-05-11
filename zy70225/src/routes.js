const express = require('express');
const router = express.Router();
const service = require('./business/service');

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'aquaculture-seed-transfer-api',
    timestamp: new Date().toISOString()
  });
});

router.get('/ponds', (req, res) => {
  const result = service.listPonds();
  res.json(result);
});

router.get('/batches', (req, res) => {
  const result = service.listBatches();
  res.json(result);
});

router.get('/batches/:id', (req, res) => {
  const result = service.getBatchDetails(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/batches', (req, res) => {
  const result = service.createBatch(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

router.post('/batches/:id/prepare-transfer', (req, res) => {
  const result = service.prepareForTransfer(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/transfers', (req, res) => {
  const result = service.listTransfers();
  res.json(result);
});

router.post('/transfers', (req, res) => {
  const result = service.executeTransfer(req.body);
  const statusCode = result.httpStatus || (result.success ? 201 : 400);
  res.status(statusCode).json(result);
});

router.post('/transfers/:id/correct', (req, res) => {
  const result = service.correctTransfer({
    transferId: req.params.id,
    ...req.body
  });
  const statusCode = result.httpStatus || (result.success ? 200 : 400);
  res.status(statusCode).json(result);
});

router.post('/batches/:id/reports', (req, res) => {
  const result = service.generateReport(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.status(201).json(result);
});

module.exports = router;