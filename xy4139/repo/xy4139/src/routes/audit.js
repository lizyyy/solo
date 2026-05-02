const express = require('express');
const router = express.Router();
const AuditService = require('../services/AuditService');

const auditService = new AuditService();

router.get('/', async (req, res, next) => {
  try {
    const options = {
      action: req.query.action,
      entity_type: req.query.entity_type,
      entity_id: req.query.entity_id,
      user_id: req.query.user_id,
      user_role: req.query.user_role,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    const result = await auditService.getAuditLogs(options, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const options = {
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    const summary = await auditService.getAuditSummary(options, req.user);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/action-types', async (req, res, next) => {
  try {
    const types = await auditService.getActionTypes();
    res.json({ data: types });
  } catch (err) {
    next(err);
  }
});

router.get('/recent', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const result = await auditService.getRecentLogs(limit, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    const result = await auditService.getAuditLogsByEntity(
      req.params.entityType,
      req.params.entityId,
      req.user
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/user/:userId', async (req, res, next) => {
  try {
    const result = await auditService.getAuditLogsByUser(req.params.userId, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const log = await auditService.getAuditLogById(req.params.id, req.user);
    res.json({ data: log });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
