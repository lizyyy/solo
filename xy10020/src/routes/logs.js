const express = require('express');
const OperationLog = require('../models/OperationLog');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', validate(schemas.listOperationLogs), async (req, res, next) => {
  try {
    const {
      startTime,
      endTime,
      entityType,
      entityId,
      userId,
      limit,
      offset
    } = req.query;

    let logs;

    if (startTime && endTime) {
      logs = OperationLog.findByTimeRange(parseInt(startTime), parseInt(endTime), {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else if (entityType && entityId) {
      logs = OperationLog.findByEntity(entityType, entityId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else if (userId) {
      logs = OperationLog.findByUserId(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      logs = OperationLog.findByTimeRange(oneDayAgo, now, {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      });
    }

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const log = OperationLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        error: '资源不存在',
        message: '操作日志不存在'
      });
    }

    res.json(log);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
