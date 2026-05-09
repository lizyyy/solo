const express = require('express');
const PushTask = require('../models/PushTask');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;

    let tasks;
    if (status) {
      tasks = PushTask.findByStatus(status, {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      });
    } else {
      const allStatuses = ['pending', 'processing', 'retrying', 'completed', 'failed'];
      tasks = [];
      for (const s of allStatuses) {
        const statusTasks = PushTask.findByStatus(s, { limit: 100, offset: 0 });
        tasks.push(...statusTasks);
      }
    }

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/statistics', async (req, res, next) => {
  try {
    const stats = PushTask.getStatistics();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const task = PushTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: '资源不存在',
        message: '推送任务不存在'
      });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('admin', 'streamer'), validate(schemas.createPushTask), async (req, res, next) => {
  try {
    const { taskType, liveRoomId, targetUserIds, payload, maxRetries, scheduledAt } = req.body;

    const task = await req.app.locals.pushTaskService.createTask(
      {
        taskType,
        liveRoomId,
        targetUserIds,
        payload,
        maxRetries,
        scheduledAt
      },
      req.user.id
    );

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
