const express = require('express');
const router = express.Router();
const temporaryStopService = require('../services/temporaryStopService');

router.post('/', (req, res) => {
  const result = temporaryStopService.createRequest(req.body);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/:id/advance', (req, res) => {
  const result = temporaryStopService.advanceRequest(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/:id/withdraw', (req, res) => {
  const result = temporaryStopService.withdrawRequest(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.put('/:id/correct', (req, res) => {
  const result = temporaryStopService.correctRequest(req.params.id, req.body);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req, res) => {
  const result = temporaryStopService.getRequests(req.query);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const result = temporaryStopService.getRequestById(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

module.exports = router;