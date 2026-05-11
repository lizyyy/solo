const express = require('express');
const { WindSpeedService } = require('../services');
const { successHandler, asyncHandler } = require('../middleware/error');
const { ERROR_CODES, BusinessError } = require('../utils');

const router = express.Router();

router.get('/status', asyncHandler(async (req, res) => {
  const { location = 'main' } = req.query;
  const status = WindSpeedService.getCurrentStatus(location);
  res.json(successHandler(status, '获取风速状态成功'));
}));

router.get('/history', asyncHandler(async (req, res) => {
  const { location = 'main', limit = 20 } = req.query;
  const history = WindSpeedService.getHistory(location, parseInt(limit));
  res.json(successHandler(history, '获取风速历史成功'));
}));

router.post('/record', asyncHandler(async (req, res) => {
  const { wind_speed, location = 'main', threshold_warning = 15, threshold_stop = 25 } = req.body;

  if (wind_speed === undefined || wind_speed === null) {
    throw new BusinessError(
      ERROR_CODES.INVALID_PARAMETER,
      '缺少必要参数：wind_speed'
    );
  }

  const record = WindSpeedService.record(
    parseFloat(wind_speed),
    location,
    parseFloat(threshold_warning),
    parseFloat(threshold_stop)
  );

  res.status(201).json(successHandler(record, '风速记录成功'));
}));

router.get('/operational', asyncHandler(async (req, res) => {
  const { location = 'main' } = req.query;
  const isOperational = WindSpeedService.isOperational(location);
  res.json(successHandler({ operational: isOperational }, '获取运行状态成功'));
}));

module.exports = router;
