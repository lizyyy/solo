const express = require('express');
const router = express.Router();
const ReprocessTask = require('../models/ReprocessTask');
const { validate } = require('../middleware/validation');

router.post('/', validate('reprocessTask'), async (req, res) => {
  try {
    const task = await ReprocessTask.create(req.body);
    res.status(201).json({
      message: '重处理任务创建成功',
      data: task
    });
  } catch (err) {
    if (err.message.includes('already has an active')) {
      return res.status(409).json({
        error: '该数据集已有进行中的重处理任务',
        code: 'TASK_ALREADY_EXISTS',
        message: err.message
      });
    }
    res.status(500).json({
      error: '创建重处理任务失败',
      code: 'TASK_CREATE_ERROR',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      dataset_id: req.query.dataset_id,
      status: req.query.status,
      priority: req.query.priority
    };
    const tasks = await ReprocessTask.findAll(filters);
    res.json({ data: tasks });
  } catch (err) {
    res.status(500).json({
      error: '获取重处理任务列表失败',
      code: 'TASK_LIST_ERROR',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const task = await ReprocessTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: '重处理任务不存在',
        code: 'TASK_NOT_FOUND'
      });
    }
    res.json({ data: task });
  } catch (err) {
    res.status(500).json({
      error: '获取重处理任务失败',
      code: 'TASK_GET_ERROR',
      message: err.message
    });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, final_conclusion, error_message } = req.body;
    const updated = await ReprocessTask.updateStatus(req.params.id, status, {
      final_conclusion,
      error_message
    });
    if (!updated) {
      return res.status(404).json({
        error: '重处理任务不存在',
        code: 'TASK_NOT_FOUND'
      });
    }
    res.json({
      message: '重处理任务状态更新成功',
      status: status
    });
  } catch (err) {
    res.status(400).json({
      error: '更新重处理任务状态失败',
      code: 'TASK_STATUS_ERROR',
      message: err.message
    });
  }
});

module.exports = router;