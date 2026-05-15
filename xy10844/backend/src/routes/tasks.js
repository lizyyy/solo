const express = require('express');
const Joi = require('joi');
const { Parser } = require('json2csv');
const TaskService = require('../services/taskService');
const { STAGES, STATUSES, STAGE_NAMES, STATUS_NAMES } = require('../constants/stages');

const router = express.Router();

const createTaskSchema = Joi.object({
  indexName: Joi.string().required(),
  dataSource: Joi.string().required(),
  targetVersion: Joi.string().required(),
  currentVersion: Joi.string().allow(null, ''),
  verifyQuery: Joi.string().allow(null, ''),
  createdBy: Joi.string().default('system')
});

const updateStageSchema = Joi.object({
  newStage: Joi.string().required(),
  newStatus: Joi.string().required(),
  reason: Joi.string().required(),
  operator: Joi.string().default('system')
});

const pauseSchema = Joi.object({
  pausePoint: Joi.string().required(),
  reason: Joi.string().required(),
  operator: Joi.string().default('system')
});

const resumeSchema = Joi.object({
  reason: Joi.string().required(),
  operator: Joi.string().default('system')
});

const verifySchema = Joi.object({
  verifyResult: Joi.string().required(),
  passed: Joi.boolean().required(),
  operator: Joi.string().default('system')
});

const grayTrafficSchema = Joi.object({
  percentage: Joi.number().min(0).max(100).required(),
  operator: Joi.string().default('system')
});

const rollbackSchema = Joi.object({
  reason: Joi.string().required(),
  operator: Joi.string().default('system')
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const task = await TaskService.createTask(value);
    res.status(201).json(task);
  } catch (err) {
    console.error('创建任务失败:', err);
    res.status(500).json({ error: '创建任务失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      stage: req.query.stage,
      status: req.query.status,
      indexName: req.query.indexName
    };

    const tasks = await TaskService.getTasks(filters);
    const tasksWithNames = tasks.map(task => ({
      ...task,
      stage_name: STAGE_NAMES[task.stage] || task.stage,
      status_name: STATUS_NAMES[task.status] || task.status
    }));

    res.json(tasksWithNames);
  } catch (err) {
    console.error('获取任务列表失败:', err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const tasks = await TaskService.getTasks();
    
    const stats = {
      total: tasks.length,
      byStage: {},
      byStatus: {}
    };

    Object.values(STAGES).forEach(stage => {
      stats.byStage[stage] = {
        count: tasks.filter(t => t.stage === stage).length,
        name: STAGE_NAMES[stage]
      };
    });

    Object.values(STATUSES).forEach(status => {
      stats.byStatus[status] = {
        count: tasks.filter(t => t.status === status).length,
        name: STATUS_NAMES[status]
      };
    });

    res.json(stats);
  } catch (err) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const task = await TaskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const taskWithNames = {
      ...task,
      stage_name: STAGE_NAMES[task.stage] || task.stage,
      status_name: STATUS_NAMES[task.status] || task.status
    };

    res.json(taskWithNames);
  } catch (err) {
    console.error('获取任务详情失败:', err);
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

router.put('/:id/stage', async (req, res) => {
  try {
    const { error, value } = updateStageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.updateStage(
      req.params.id,
      value.newStage,
      value.newStatus,
      value.reason,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('更新阶段失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/pause', async (req, res) => {
  try {
    const { error, value } = pauseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.pauseTask(
      req.params.id,
      value.pausePoint,
      value.reason,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('暂停任务失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/resume', async (req, res) => {
  try {
    const { error, value } = resumeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.resumeTask(
      req.params.id,
      value.reason,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('恢复任务失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/verify', async (req, res) => {
  try {
    const { error, value } = verifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.updateVerifyResult(
      req.params.id,
      value.verifyResult,
      value.passed,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('更新验证结果失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/gray-traffic', async (req, res) => {
  try {
    const { error, value } = grayTrafficSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.updateGrayTraffic(
      req.params.id,
      value.percentage,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('更新灰度流量失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/rollback', async (req, res) => {
  try {
    const { error, value } = rollbackSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedTask = await TaskService.rollback(
      req.params.id,
      value.reason,
      value.operator
    );

    res.json(updatedTask);
  } catch (err) {
    console.error('回滚任务失败:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await TaskService.getTaskLogs(req.params.id);
    const logsWithNames = logs.map(log => ({
      ...log,
      stage_name: STAGE_NAMES[log.stage] || log.stage,
      status_name: STATUS_NAMES[log.status] || log.status
    }));
    res.json(logsWithNames);
  } catch (err) {
    console.error('获取任务日志失败:', err);
    res.status(500).json({ error: '获取任务日志失败' });
  }
});

router.get('/:id/switch-records', async (req, res) => {
  try {
    const records = await TaskService.getSwitchRecords(req.params.id);
    res.json(records);
  } catch (err) {
    console.error('获取切换记录失败:', err);
    res.status(500).json({ error: '获取切换记录失败' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const tasks = await TaskService.getAllTasksForExport();
    
    const fields = [
      { label: '任务ID', value: 'id' },
      { label: '索引名称', value: 'index_name' },
      { label: '数据源', value: 'data_source' },
      { label: '阶段', value: row => STAGE_NAMES[row.stage] || row.stage },
      { label: '状态', value: row => STATUS_NAMES[row.status] || row.status },
      { label: '当前版本', value: 'current_version' },
      { label: '目标版本', value: 'target_version' },
      { label: '验证查询', value: 'verify_query' },
      { label: '验证结果', value: 'verify_result' },
      { label: '灰度流量(%)', value: 'gray_traffic_percentage' },
      { label: '错误信息', value: 'error_message' },
      { label: '状态原因', value: 'state_reason' },
      { label: '创建人', value: 'created_by' },
      { label: '创建时间', value: row => new Date(row.created_at).toLocaleString('zh-CN') },
      { label: '更新时间', value: row => new Date(row.updated_at).toLocaleString('zh-CN') },
      { label: '完成时间', value: row => row.completed_at ? new Date(row.completed_at).toLocaleString('zh-CN') : '' },
      { label: '日志摘要', value: 'log_messages' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(tasks);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="index_rebuild_tasks_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('导出CSV失败:', err);
    res.status(500).json({ error: '导出CSV失败' });
  }
});

module.exports = router;