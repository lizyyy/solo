const express = require('express');
const router = express.Router();
const ProcessingService = require('../services/ProcessingService');
const { handleError } = require('../utils/errorHandler');

router.post('/conversations/:id/results', async (req, res, next) => {
  try {
    const result = await ProcessingService.submitResult(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id/results', async (req, res, next) => {
  try {
    const results = ProcessingService.getConversationResults(req.params.id);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:id/corrections', async (req, res, next) => {
  try {
    const result = await ProcessingService.makeCorrection(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id/corrections', async (req, res, next) => {
  try {
    const corrections = ProcessingService.getCorrections(req.params.id);
    res.json({ success: true, data: corrections });
  } catch (err) {
    next(err);
  }
});

router.use(handleError);

module.exports = router;
