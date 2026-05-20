const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const schedulerService = require('../services/schedulerService');

router.post('/tides', async (req, res) => {
  try {
    const tideData = req.body;
    const tideId = await schedulerService.addTideData(tideData);
    res.json({ 
      success: true, 
      message: '潮汐数据添加成功',
      tide_id: tideId 
    });
  } catch (error) {
    console.error('添加潮汐数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/tides', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const tides = await schedulerService.getTideDataByDateRange(
      start_date || '2024-01-01',
      end_date || '2024-12-31'
    );
    res.json({ success: true, data: tides });
  } catch (error) {
    console.error('获取潮汐数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const result = await taskService.createTask(req.body);
    
    if (!result.success && result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
        errorDetails: result.errorDetails
      });
    }

    res.json(result);
  } catch (error) {
    console.error('提交材料失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const result = await taskService.getTask(req.params.taskId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = await taskService.listTasks(
      status,
      parseInt(page) || 1,
      parseInt(pageSize) || 20
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.patch('/:taskId/status', async (req, res) => {
  try {
    const { status, changed_by, reason } = req.body;
    const result = await taskService.updateTaskStatus(
      req.params.taskId,
      status,
      changed_by,
      reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:taskId/audit-logs', async (req, res) => {
  try {
    const logs = await taskService.getAuditLogs(req.params.taskId);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.post('/:taskId/export', async (req, res) => {
  try {
    const { exported_by } = req.body;
    const result = await taskService.exportTask(req.params.taskId, exported_by);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('导出任务失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

router.post('/berth-assignments/:assignmentId/lock', async (req, res) => {
  try {
    const { locked_by } = req.body;
    const result = await schedulerService.lockBerthAssignment(
      req.params.assignmentId,
      locked_by
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('锁定泊位失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/berth-assignments/:assignmentId/adjust', async (req, res) => {
  try {
    const { new_berth_id, adjusted_by, reason } = req.body;
    const result = await schedulerService.adjustBerthAssignment(
      req.params.assignmentId,
      new_berth_id,
      adjusted_by,
      reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('调整泊位失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/berth-assignments/:assignmentId/adjustments', async (req, res) => {
  try {
    const adjustments = await schedulerService.getAssignmentAdjustments(
      req.params.assignmentId
    );
    res.json({ success: true, data: adjustments });
  } catch (error) {
    console.error('获取泊位调整记录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message
    });
  }
});

module.exports = router;
