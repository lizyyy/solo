const express = require('express');
const router = express.Router();
const HandoverService = require('../services/HandoverService');

const handoverService = new HandoverService();

router.get('/', (req, res) => {
  try {
    const records = handoverService.getAllRecords();
    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/normal', (req, res) => {
  try {
    const records = handoverService.getNormalRecords();
    res.json({
      success: true,
      data: records,
      count: records.length,
      message: '正常记录 - 所有校验均通过'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/abnormal', (req, res) => {
  try {
    const records = handoverService.getAbnormalRecords();
    res.json({
      success: true,
      data: records,
      count: records.length,
      message: '异常记录 - 包含待处理或驳回的记录'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const stats = handoverService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const record = handoverService.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const result = handoverService.createRecord(req.body);
    res.json({
      success: true,
      data: result.record,
      validationResult: result.result,
      message: result.result.success ? '记录创建成功，校验通过' : '记录创建成功，但存在异常需要处理'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/process', (req, res) => {
  try {
    const result = handoverService.processRecord(req.params.id);
    res.json({
      success: true,
      data: result.record,
      validationResult: result.result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/confirm-nurse', (req, res) => {
  try {
    const result = handoverService.confirmNurseConfirmation(req.params.id, req.body);
    res.json({
      success: true,
      data: result.record,
      validationResult: result.result,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/medication-records', (req, res) => {
  try {
    const result = handoverService.updateMedicationRecords(req.params.id, req.body.medicationRecords);
    res.json({
      success: true,
      data: result.record,
      validationResult: result.result,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
