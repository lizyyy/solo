const express = require('express');
const Joi = require('joi');
const pushService = require('../services/pushService');
const { authenticate, requireRole } = require('../middleware/auth');
const { withLock } = require('../middleware/concurrency');
const { success, error: errorResponse, pagination } = require('../utils/response');

const router = express.Router();

const createPushSchema = Joi.object({
  title: Joi.string().required().min(1).max(200),
  content: Joi.string().required().min(1).max(5000),
  pushType: Joi.string().valid('broadcast', 'targeted', 'system').default('broadcast'),
  targetUsers: Joi.array().items(Joi.string()).default([]),
  priority: Joi.number().integer().min(-10).max(10).default(0),
  scheduledAt: Joi.date().optional(),
});

const updatePushSchema = Joi.object({
  title: Joi.string().min(1).max(200),
  content: Joi.string().min(1).max(5000),
  pushType: Joi.string().valid('broadcast', 'targeted', 'system'),
  targetUsers: Joi.array().items(Joi.string()),
  priority: Joi.number().integer().min(-10).max(10),
  scheduledAt: Joi.date().optional(),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    
    const filters = {
      status: req.query.status,
      pushType: req.query.pushType,
      keyword: req.query.keyword,
      createdBy: req.query.createdBy,
    };
    
    const { messages, total } = await pushService.getPushMessages(filters, page, limit);
    res.json(pagination(messages, total, page, limit));
  } catch (err) {
    next(err);
  }
});

router.get('/statistics', authenticate, async (req, res, next) => {
  try {
    const stats = await pushService.getStatistics();
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const message = await pushService.getPushMessageById(req.params.id);
    
    if (!message) {
      return res.status(404).json(errorResponse('Message not found', 404));
    }
    
    res.json(success(message));
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const { error, value } = createPushSchema.validate(req.body);
    if (error) {
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }
    
    const message = await pushService.enqueuePushMessage(value, req.user, req);
    res.status(201).json(success(message, 'Push message created successfully'));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('admin', 'operator'), withLock('id'), async (req, res, next) => {
  try {
    const { error, value } = updatePushSchema.validate(req.body);
    if (error) {
      await res.releaseLock();
      return res.status(400).json(errorResponse(error.details[0].message, 400));
    }
    
    const message = await pushService.updatePushMessage(req.params.id, value, req.user, req);
    await res.releaseLock();
    res.json(success(message, 'Push message updated successfully'));
  } catch (err) {
    await res.releaseLock();
    next(err);
  }
});

router.post('/:id/cancel', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const message = await pushService.cancelPushMessage(req.params.id, req.user, req);
    res.json(success(message, 'Push message cancelled successfully'));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/retry', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    const message = await pushService.retryPushMessage(req.params.id, req.user, req);
    res.json(success(message, 'Push message retried successfully'));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('admin', 'operator'), async (req, res, next) => {
  try {
    await pushService.deletePushMessage(req.params.id, req.user, req);
    res.json(success(null, 'Push message deleted successfully'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
