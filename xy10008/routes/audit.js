const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditStats, ENTITY_TYPES } = require('../utils/audit');
const logger = require('../utils/logger');
const taskQueue = require('../utils/taskQueue');

router.get('/', async (req, res) => {
  try {
    const { entityType, entityId, limit, offset } = req.query;
    
    const logs = getAuditLogs(
      entityType || null,
      entityId || null,
      parseInt(limit) || 100,
      parseInt(offset) || 0
    );
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('GET /api/audit error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = getAuditStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('GET /api/audit/stats error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/entity-types', async (req, res) => {
  try {
    res.json({ success: true, data: ENTITY_TYPES });
  } catch (error) {
    logger.error('GET /api/audit/entity-types error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/failed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const tasks = taskQueue.getFailedTasks(limit);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('GET /api/audit/tasks/failed error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:taskId/retry', async (req, res) => {
  try {
    const result = taskQueue.retryFailedTask(req.params.taskId);
    res.json({ success: true, data: { message: 'Task queued for retry', result }});
  } catch (error) {
    logger.error('POST /api/audit/tasks/:taskId/retry error', { error: error.message, taskId: req.params.taskId });
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
