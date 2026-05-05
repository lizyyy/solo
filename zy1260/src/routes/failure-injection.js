const express = require('express');
const router = express.Router();
const FailureInjector = require('../utils/failure-injector');

router.post('/inject', (req, res) => {
  try {
    const { step, failureType } = req.body;
    
    if (!step) {
      return res.status(400).json({
        error: '缺少 step 参数',
        availableSteps: Object.values(FailureInjector.STEPS)
      });
    }

    if (!Object.values(FailureInjector.STEPS).includes(step)) {
      return res.status(400).json({
        error: '无效的 step 值',
        availableSteps: Object.values(FailureInjector.STEPS)
      });
    }

    if (failureType && !Object.values(FailureInjector.FAILURE_TYPES).includes(failureType)) {
      return res.status(400).json({
        error: '无效的 failureType 值',
        availableTypes: Object.values(FailureInjector.FAILURE_TYPES)
      });
    }

    const result = FailureInjector.inject(step, failureType || FailureInjector.FAILURE_TYPES.ERROR);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clear', (req, res) => {
  try {
    const { step } = req.body;
    const result = FailureInjector.clear(step || null);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active', (req, res) => {
  try {
    const active = FailureInjector.listActive();
    res.json({
      count: active.length,
      injections: active
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/steps', (req, res) => {
  res.json({
    steps: Object.values(FailureInjector.STEPS),
    failureTypes: Object.values(FailureInjector.FAILURE_TYPES)
  });
});

module.exports = router;
