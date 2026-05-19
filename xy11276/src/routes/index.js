const express = require('express');
const router = express.Router();
const Joi = require('joi');

const ForkliftService = require('../services/forklift.service');
const ChargingService = require('../services/charging.service');
const ShiftService = require('../services/shift.service');
const TaskService = require('../services/task.service');
const HistoryService = require('../services/history.service');
const ReportService = require('../services/report.service');
const validations = require('../validations/forklift.validation');
const logger = require('../utils/logger');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.details[0].message 
      });
    }
    next();
  };
};

const getOperatorInfo = (req) => ({
  name: req.headers['x-operator-name'] || 'system',
  role: req.headers['x-operator-role'] || 'operator'
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '仓库夜班管理系统运行正常',
    timestamp: new Date().toISOString()
  });
});

router.get('/forklifts', async (req, res) => {
  try {
    const forklifts = await ForkliftService.getAll();
    res.json({ success: true, data: forklifts });
  } catch (error) {
    logger.error('获取叉车列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forklifts/low-battery', async (req, res) => {
  try {
    const forklifts = await ForkliftService.getLowBattery();
    res.json({ success: true, data: forklifts });
  } catch (error) {
    logger.error('获取低电量叉车失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forklifts/available', async (req, res) => {
  try {
    const forklifts = await ForkliftService.getAvailable();
    res.json({ success: true, data: forklifts });
  } catch (error) {
    logger.error('获取可用叉车失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forklifts/:id', async (req, res) => {
  try {
    const forklift = await ForkliftService.getById(req.params.id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: '叉车不存在' });
    }
    res.json({ success: true, data: forklift });
  } catch (error) {
    logger.error('获取叉车详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/forklifts', validateRequest(validations.createForkliftSchema), async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const forklift = await ForkliftService.create(req.body, operator.name);
    res.status(201).json({ success: true, data: forklift });
  } catch (error) {
    logger.error('创建叉车失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/forklifts/:id/battery', async (req, res) => {
  try {
    const { batteryLevel } = req.body;
    if (batteryLevel === undefined || batteryLevel < 0 || batteryLevel > 100) {
      return res.status(400).json({ success: false, error: '电量值必须在0-100之间' });
    }
    const operator = getOperatorInfo(req);
    const forklift = await ForkliftService.updateBattery(req.params.id, batteryLevel, operator.name);
    res.json({ success: true, data: forklift });
  } catch (error) {
    logger.error('更新叉车电量失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/forklifts/:id', async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    await ForkliftService.delete(req.params.id, operator.name);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除叉车失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/charging-stations', async (req, res) => {
  try {
    const stations = await ChargingService.getAll();
    res.json({ success: true, data: stations });
  } catch (error) {
    logger.error('获取充电桩列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/charging-stations/status', async (req, res) => {
  try {
    const status = await ChargingService.getChargingStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('获取充电状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/charging-stations', validateRequest(validations.createChargingStationSchema), async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const station = await ChargingService.create(req.body, operator.name);
    res.status(201).json({ success: true, data: station });
  } catch (error) {
    logger.error('创建充电桩失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/charging-stations/:id/start', async (req, res) => {
  try {
    const { forkliftId } = req.body;
    if (!forkliftId) {
      return res.status(400).json({ success: false, error: '叉车ID不能为空' });
    }
    const operator = getOperatorInfo(req);
    const station = await ChargingService.startCharging(req.params.id, forkliftId, operator.name);
    res.json({ success: true, data: station });
  } catch (error) {
    logger.error('开始充电失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/charging-stations/:id/stop', async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const result = await ChargingService.stopCharging(req.params.id, operator.name);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('停止充电失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/shifts', async (req, res) => {
  try {
    const shifts = await ShiftService.getAll();
    res.json({ success: true, data: shifts });
  } catch (error) {
    logger.error('获取班次列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/shifts/:id', async (req, res) => {
  try {
    const shift = await ShiftService.getById(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, error: '班次不存在' });
    }
    res.json({ success: true, data: shift });
  } catch (error) {
    logger.error('获取班次详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/shifts/:id/summary', async (req, res) => {
  try {
    const summary = await ShiftService.getShiftSummary(req.params.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('获取班次摘要失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/shifts/:id/conflicts', async (req, res) => {
  try {
    const conflicts = await TaskService.getConflicts(req.params.id);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    logger.error('检查任务冲突失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/shifts', validateRequest(validations.createShiftSchema), async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const shift = await ShiftService.create(req.body, operator.name);
    res.status(201).json({ success: true, data: shift });
  } catch (error) {
    logger.error('创建班次失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/shifts/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const operator = getOperatorInfo(req);
    const shift = await ShiftService.updateStatus(req.params.id, status, operator.name);
    res.json({ success: true, data: shift });
  } catch (error) {
    logger.error('更新班次状态失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const tasks = await TaskService.getAll();
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('获取任务列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tasks/shift/:shiftId', async (req, res) => {
  try {
    const tasks = await TaskService.getByShiftId(req.params.shiftId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('获取班次任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tasks', validateRequest(validations.createTaskSchema), async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const task = await TaskService.create(req.body, operator.name);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error('创建任务失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/assign', validateRequest(validations.assignTaskSchema), async (req, res) => {
  try {
    const { forkliftId, operatorName } = req.body;
    const operator = getOperatorInfo(req);
    const task = await TaskService.assign(req.params.id, forkliftId, operatorName, operator.name);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('分配任务失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/start', async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const task = await TaskService.startTask(req.params.id, operator.name);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('开始任务失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const task = await TaskService.completeTask(req.params.id, operator.name);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('完成任务失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const operator = getOperatorInfo(req);
    const task = await TaskService.cancelTask(req.params.id, operator.name);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('取消任务失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { entityType, startDate, endDate } = req.query;
    const logs = await HistoryService.getByDateRange(startDate, endDate, entityType);
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('获取历史记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/shift/:shiftId/summary', async (req, res) => {
  try {
    const report = await ReportService.generateShiftSummaryReport(req.params.shiftId);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('生成班次摘要报告失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/shift/:shiftId/export', async (req, res) => {
  try {
    const csv = await ReportService.exportShiftTasks(req.params.shiftId, 'csv');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="shift-tasks-${req.params.shiftId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    logger.error('导出班次任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/forklifts/export', async (req, res) => {
  try {
    const csv = await ReportService.exportForkliftStatus('csv');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="forklift-status.csv"');
    res.send('\uFEFF' + csv);
  } catch (error) {
    logger.error('导出叉车状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;