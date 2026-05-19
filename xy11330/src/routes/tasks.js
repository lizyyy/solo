const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

router.get('/', async (req, res) => {
  try {
    const filters = {
      escort_id: req.query.escort_id,
      status: req.query.status,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      is_overdue: req.query.is_overdue === 'true' ? true : req.query.is_overdue === 'false' ? false : undefined,
      is_inserted: req.query.is_inserted === 'true' ? true : req.query.is_inserted === 'false' ? false : undefined
    };

    const tasks = await Task.findAll(filters);
    res.json({
      success: true,
      data: tasks,
      total: tasks.length
    });
  } catch (err) {
    console.error('查询任务列表失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    console.error('查询任务详情失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await Task.getLogs(req.params.id);
    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('查询任务日志失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/assign', async (req, res) => {
  try {
    const { escort_id, operator } = req.body;
    
    if (!escort_id) {
      return res.status(400).json({
        success: false,
        error: '陪检员ID不能为空'
      });
    }

    const result = await Task.assign(req.params.id, escort_id, operator || 'api');
    res.json({
      success: true,
      message: '派单成功',
      data: result
    });
  } catch (err) {
    console.error('派单失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/accept', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await Task.accept(req.params.id, operator || 'api');
    res.json({
      success: true,
      message: '接单成功',
      data: result
    });
  } catch (err) {
    console.error('接单失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await Task.start(req.params.id, operator || 'api');
    res.json({
      success: true,
      message: '开始陪检成功',
      data: result
    });
  } catch (err) {
    console.error('开始陪检失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/complete', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await Task.complete(req.params.id, operator || 'api');
    res.json({
      success: true,
      message: '完成陪检成功',
      data: result
    });
  } catch (err) {
    console.error('完成陪检失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason, operator } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: '取消原因不能为空'
      });
    }

    const result = await Task.cancel(req.params.id, reason, operator || 'api');
    res.json({
      success: true,
      message: '取消任务成功',
      data: result
    });
  } catch (err) {
    console.error('取消任务失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/insert', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await Task.insert(req.params.id, operator || 'api');
    res.json({
      success: true,
      message: '插队处理成功',
      data: result
    });
  } catch (err) {
    console.error('插队处理失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/check-overdue', async (req, res) => {
  try {
    const { overdue_minutes } = req.body;
    const result = await Task.checkOverdue(
      req.params.id, 
      overdue_minutes ? parseInt(overdue_minutes) : 30, 
      'api'
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('检查超时失败:', err);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
