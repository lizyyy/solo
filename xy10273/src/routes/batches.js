const express = require('express');
const router = express.Router();
const Joi = require('joi');
const {
  createBatch,
  getBatchById,
  getBatchesByActivity,
  createSampleArchive,
  getSampleById,
  getSamplesByActivity,
  getSamplesForDestroyReminder,
  advanceSampleStatus,
  destroySample,
  retainSampleForInvestigation,
  updateSampleArchive,
  withdrawSampleArchive,
  SAMPLE_STATUS
} = require('../services/batchService');

const createBatchSchema = Joi.object({
  batchNumber: Joi.string().required(),
  productionDate: Joi.string().required(),
  expirationDate: Joi.string().required(),
  quantity: Joi.number().integer().positive().required()
});

const createSampleSchema = Joi.object({
  activityId: Joi.string().required(),
  batchId: Joi.string().required(),
  sampleQuantity: Joi.number().integer().positive().required(),
  storageLocation: Joi.string().required(),
  archiveDate: Joi.string().required(),
  shelfLifeDays: Joi.number().integer().positive().optional()
});

const updateSampleSchema = Joi.object({
  storageLocation: Joi.string().optional(),
  sampleQuantity: Joi.number().integer().positive().optional()
});

const sampleStatusSchema = Joi.object({
  targetStatus: Joi.string().valid(...Object.values(SAMPLE_STATUS)).required()
});

router.post('/activities/:activityId/batches', async (req, res) => {
  const { error } = createBatchSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await createBatch(req.params.activityId, req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'CANCELLED_ACTIVITY') {
      return res.status(400).json(result);
    }
    if (result.isDuplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('创建批次失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/activities/:activityId/batches', async (req, res) => {
  try {
    const batches = await getBatchesByActivity(req.params.activityId);
    res.json({ success: true, data: batches });
  } catch (err) {
    console.error('查询批次列表失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/batches/:id', async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    console.error('查询批次失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/samples', async (req, res) => {
  const { error } = createSampleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await createSampleArchive(req.body, requestId, operator);
    if (result.code === 'NOT_FOUND' || result.code === 'BATCH_MISMATCH' || result.code === 'QUANTITY_EXCEEDED') {
      return res.status(400).json(result);
    }
    if (result.isDuplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('创建留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/samples/reminders', async (req, res) => {
  try {
    const targetDate = req.query.targetDate || new Date().toISOString().split('T')[0];
    const samples = await getSamplesForDestroyReminder(targetDate);
    res.json({
      success: true,
      targetDate,
      count: samples.length,
      data: samples
    });
  } catch (err) {
    console.error('查询销毁提醒失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/samples/:id', async (req, res) => {
  try {
    const sample = await getSampleById(req.params.id);
    if (!sample) {
      return res.status(404).json({ success: false, error: '留样记录不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: sample });
  } catch (err) {
    console.error('查询留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/activities/:activityId/samples', async (req, res) => {
  try {
    const samples = await getSamplesByActivity(req.params.activityId);
    res.json({ success: true, data: samples });
  } catch (err) {
    console.error('查询活动留样列表失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.put('/samples/:id', async (req, res) => {
  const { error } = updateSampleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await updateSampleArchive(req.params.id, req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'READONLY_STATUS') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('更新留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/samples/:id/advance', async (req, res) => {
  const { error } = sampleStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await advanceSampleStatus(req.params.id, req.body.targetStatus, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_STATUS' || result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('推进留样状态失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/samples/:id/destroy', async (req, res) => {
  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await destroySample(req.params.id, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('销毁留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/samples/:id/retain', async (req, res) => {
  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';
  const reason = req.body.reason || '';

  try {
    const result = await retainSampleForInvestigation(req.params.id, requestId, operator, reason);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('留存留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/samples/:id/withdraw', async (req, res) => {
  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';
  const reason = req.body.reason || '';

  try {
    const result = await withdrawSampleArchive(req.params.id, requestId, operator, reason);
    if (result.code === 'NOT_FOUND' || result.code === 'READONLY_STATUS' || result.code === 'INVALID_STATUS') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('撤回留样失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
