const express = require('express');
const router = express.Router();
const Joi = require('joi');
const {
  createActivity,
  getActivityById,
  getActivities,
  advanceActivityStatus,
  cancelActivity,
  updateActivity,
  getActivitySummary,
  ACTIVITY_STATUS
} = require('../services/activityService');

const createActivitySchema = Joi.object({
  storeId: Joi.string().required(),
  storeName: Joi.string().required(),
  activityName: Joi.string().required(),
  activityDate: Joi.string().required(),
  productName: Joi.string().required(),
  description: Joi.string().optional()
});

const updateActivitySchema = Joi.object({
  activityName: Joi.string().optional(),
  activityDate: Joi.string().optional(),
  productName: Joi.string().optional(),
  description: Joi.string().optional()
});

const statusSchema = Joi.object({
  targetStatus: Joi.string().valid(...Object.values(ACTIVITY_STATUS)).required()
});

router.post('/', async (req, res) => {
  const { error } = createActivitySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await createActivity(req.body, requestId, operator);
    if (result.isDuplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('创建活动失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      storeId: req.query.storeId,
      status: req.query.status,
      activityDateFrom: req.query.activityDateFrom,
      activityDateTo: req.query.activityDateTo
    };
    const activities = await getActivities(filters);
    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('查询活动列表失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const activity = await getActivityById(req.params.id);
    if (!activity) {
      return res.status(404).json({ success: false, error: '活动不存在', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: activity });
  } catch (err) {
    console.error('查询活动失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const result = await getActivitySummary(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('查询活动汇总失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.put('/:id', async (req, res) => {
  const { error } = updateActivitySchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await updateActivity(req.params.id, req.body, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'READONLY_STATUS') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('更新活动失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/:id/advance', async (req, res) => {
  const { error } = statusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message, code: 'VALIDATION_ERROR' });
  }

  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await advanceActivityStatus(req.params.id, req.body.targetStatus, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_STATUS' || result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('推进活动状态失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/:id/cancel', async (req, res) => {
  const requestId = req.headers['x-request-id'];
  const operator = req.headers['x-operator'] || 'system';

  try {
    const result = await cancelActivity(req.params.id, requestId, operator);
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    if (result.code === 'INVALID_TRANSITION') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('取消活动失败:', err);
    res.status(500).json({ success: false, error: err.message, code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
