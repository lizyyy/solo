const express = require('express');
const router = express.Router();
const evaluationService = require('../services/evaluationService');

router.post('/', async (req, res) => {
  try {
    const evaluation = await evaluationService.createEvaluation(req.body);
    res.status(201).json({ success: true, data: evaluation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/schedule/:scheduleId', async (req, res) => {
  try {
    const evaluations = await evaluationService.getEvaluationsBySchedule(req.params.scheduleId);
    res.json({ success: true, data: evaluations });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const evaluation = await evaluationService.getEvaluation(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ success: false, error: '评价记录不存在' });
    }
    res.json({ success: true, data: evaluation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/review', async (req, res) => {
  try {
    const { status, review_notes } = req.body;
    const evaluation = await evaluationService.reviewEvaluation(
      req.params.id,
      status,
      review_notes,
      req.body.operator || 'system'
    );
    res.json({ success: true, data: evaluation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/correct', async (req, res) => {
  try {
    const evaluation = await evaluationService.manualCorrect(
      req.params.id,
      req.body,
      req.body.operator || 'system'
    );
    res.json({ success: true, data: evaluation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
