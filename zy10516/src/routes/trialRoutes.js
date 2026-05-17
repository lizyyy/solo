const express = require('express');
const router = express.Router();
const trialService = require('../services/trialService');
const {
  validateCreateTrial,
  validateAdvanceStatus,
  validateFalsePositive,
  validateManualCorrection
} = require('../validations/trialValidation');

router.post('/', validateCreateTrial, async (req, res, next) => {
  try {
    const trial = trialService.createTrial(req.validatedBody);
    res.status(201).json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res) => {
  const filters = {
    status: req.query.status,
    metricName: req.query.metricName
  };
  const trials = trialService.getAllTrials(filters);
  res.json({
    code: 'SUCCESS',
    data: trials.map(t => t.toJSON()),
    total: trials.length
  });
});

router.get('/:id', (req, res, next) => {
  try {
    const trial = trialService.getTrial(req.params.id);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }
    res.json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/calculate', async (req, res, next) => {
  try {
    const trial = await trialService.runThresholdCalculation(req.params.id);
    res.json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/advance-status', validateAdvanceStatus, (req, res, next) => {
  try {
    const trial = trialService.advanceStatus(
      req.params.id,
      req.validatedBody.targetStatus,
      req.validatedBody.note
    );
    res.json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/false-positive', validateFalsePositive, (req, res, next) => {
  try {
    const trial = trialService.addFalsePositive(req.params.id, req.validatedBody);
    res.json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/manual-correction', validateManualCorrection, (req, res, next) => {
  try {
    const trial = trialService.applyManualCorrection(req.params.id, req.validatedBody);
    res.json({
      code: 'SUCCESS',
      data: trial.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/export', (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    const report = trialService.exportReport(req.params.id, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trial-report-${req.params.id}.csv"`);
      res.send(report);
    } else {
      res.json({
        code: 'SUCCESS',
        data: report
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:id/original-input', (req, res, next) => {
  try {
    const trial = trialService.getTrial(req.params.id);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }
    res.json({
      code: 'SUCCESS',
      data: trial.originalInput
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;