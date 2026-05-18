const express = require('express');
const router = express.Router();
const store = require('../store/sampleStore');
const { validateSampleData, getAllowedActions, SAMPLE_STATUS } = require('../models/sampleModel');

router.get('/', (req, res) => {
  const samples = store.getAllSamples();
  res.json({
    success: true,
    data: samples,
    count: samples.length
  });
});

router.get('/statistics', (req, res) => {
  const stats = store.getStatistics();
  res.json({
    success: true,
    data: stats
  });
});

router.get('/:id', (req, res) => {
  const sample = store.getSampleById(req.params.id);
  if (!sample) {
    return res.status(404).json({
      success: false,
      error: '留样记录不存在'
    });
  }
  
  const consistencyIssues = store.checkConsistency(sample);
  const allowedActions = getAllowedActions(sample.status);
  
  res.json({
    success: true,
    data: {
      ...sample,
      consistencyIssues,
      allowedActions
    }
  });
});

router.get('/boxcode/:code', (req, res) => {
  const samples = store.getSamplesByBoxCode(req.params.code);
  const isDuplicate = store.checkDuplicateBoxCode(req.params.code);
  
  res.json({
    success: true,
    data: samples,
    isDuplicate,
    count: samples.length
  });
});

router.post('/', (req, res) => {
  const data = req.body;
  
  const validationErrors = validateSampleData(data);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: validationErrors
    });
  }
  
  const isDuplicate = store.checkDuplicateBoxCode(data.sampleBoxCode);
  if (isDuplicate) {
    return res.status(409).json({
      success: false,
      error: '留样盒编号重复，该留样盒正在使用中',
      duplicateBoxCode: data.sampleBoxCode
    });
  }
  
  const sample = store.addSample(data);
  
  res.status(201).json({
    success: true,
    data: sample
  });
});

router.patch('/:id/status', (req, res) => {
  const { newStatus, operator, source, remark } = req.body;
  
  if (!newStatus) {
    return res.status(400).json({
      success: false,
      error: '新状态不能为空'
    });
  }
  
  if (!operator) {
    return res.status(400).json({
      success: false,
      error: '操作者不能为空'
    });
  }
  
  if (!Object.values(SAMPLE_STATUS).includes(newStatus)) {
    return res.status(400).json({
      success: false,
      error: '无效的状态值'
    });
  }
  
  const result = store.updateSampleStatus(req.params.id, newStatus, operator, source, remark);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.patch('/:id/inspection', (req, res) => {
  const { result, inspector } = req.body;
  
  if (!result) {
    return res.status(400).json({
      success: false,
      error: '检验结果不能为空'
    });
  }
  
  if (!inspector) {
    return res.status(400).json({
      success: false,
      error: '检验员不能为空'
    });
  }
  
  const updateResult = store.updateInspectionResult(req.params.id, result, inspector);
  
  if (!updateResult.success) {
    return res.status(400).json(updateResult);
  }
  
  res.json(updateResult);
});

router.get('/:id/allowed-actions', (req, res) => {
  const sample = store.getSampleById(req.params.id);
  if (!sample) {
    return res.status(404).json({
      success: false,
      error: '留样记录不存在'
    });
  }
  
  const allowedActions = getAllowedActions(sample.status);
  
  res.json({
    success: true,
    data: {
      currentStatus: sample.status,
      allowedActions
    }
  });
});

module.exports = router;
