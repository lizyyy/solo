const express = require('express');
const { ScheduleService } = require('../services');
const { successHandler, asyncHandler } = require('../middleware/error');
const { ERROR_CODES, BusinessError, STATUS } = require('../utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const schedules = ScheduleService.getAll(status);
  res.json(successHandler(schedules, '获取班次列表成功'));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedule = ScheduleService.getById(id);
  
  if (!schedule) {
    throw new BusinessError(
      ERROR_CODES.SCHEDULE_NOT_FOUND,
      `班次不存在：${id}`
    );
  }
  
  res.json(successHandler(schedule, '获取班次成功'));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { route, departure_time, arrival_time, capacity } = req.body;
  const schedule = ScheduleService.create({
    route,
    departureTime: departure_time,
    arrivalTime: arrival_time,
    capacity
  });
  res.status(201).json(successHandler(schedule, '创建班次成功'));
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status) {
    throw new BusinessError(
      ERROR_CODES.INVALID_PARAMETER,
      '缺少必要参数：status'
    );
  }

  const validStatuses = Object.values(STATUS.SCHEDULE);
  if (!validStatuses.includes(status)) {
    throw new BusinessError(
      ERROR_CODES.INVALID_PARAMETER,
      `无效的状态值：${status}，有效值：${validStatuses.join(', ')}`
    );
  }

  const schedule = ScheduleService.updateStatus(id, status, reason);
  res.json(successHandler(schedule, '更新班次状态成功'));
}));

router.post('/:id/cancel-wind', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedule = ScheduleService.cancelDueToWind(id);
  res.json(successHandler(schedule, '因风速取消班次成功'));
}));

router.post('/cancel-all-wind', asyncHandler(async (req, res) => {
  const result = ScheduleService.cancelAllAffectedByWind();
  res.json(successHandler(result, '批量取消受影响班次成功'));
}));

module.exports = router;
