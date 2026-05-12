const express = require('express');
const router = express.Router();
const experimentManager = require('../services/ExperimentManager');

router.post('/', (req, res) => {
  try {
    const experiment = experimentManager.registerExperiment(req.body);
    res.status(201).json({
      success: true,
      experiment: experiment.getStats()
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/', (req, res) => {
  const experiments = experimentManager.getExperiments();
  res.json({
    success: true,
    experiments
  });
});

router.get('/:id', (req, res) => {
  const experiment = experimentManager.getExperiment(req.params.id);
  if (!experiment) {
    return res.status(404).json({
      success: false,
      error: '实验不存在'
    });
  }
  res.json({
    success: true,
    experiment: experiment.getStats()
  });
});

router.post('/:id/pause', (req, res) => {
  const result = experimentManager.pauseExperiment(req.params.id, req.body.reason || '手动暂停');
  if (!result) {
    return res.status(404).json({
      success: false,
      error: '实验不存在'
    });
  }
  res.json({
    success: true,
    experiment: result
  });
});

router.post('/:id/resume', (req, res) => {
  const result = experimentManager.resumeExperiment(req.params.id);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: '实验不存在'
    });
  }
  res.json({
    success: true,
    experiment: result
  });
});

router.post('/:id/shadow', async (req, res) => {
  const result = await experimentManager.processShadowRequest(req.params.id, req.body);
  
  if (!result.success) {
    let statusCode = 400;
    if (result.code === 'EXPERIMENT_NOT_FOUND') {
      statusCode = 404;
    } else if (result.code === 'EXPERIMENT_PAUSED') {
      statusCode = 403;
    }
    return res.status(statusCode).json(result);
  }
  
  res.json(result);
});

router.get('/:id/report', (req, res) => {
  const report = experimentManager.generateReport(req.params.id);
  if (!report) {
    return res.status(404).json({
      success: false,
      error: '实验不存在'
    });
  }
  res.json({
    success: true,
    report
  });
});

module.exports = router;
