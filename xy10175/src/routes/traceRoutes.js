const express = require('express');
const Joi = require('joi');
const TraceService = require('../services/traceService');

const router = express.Router();

const querySchema = Joi.object({
  startTime: Joi.string().isoDate().optional(),
  endTime: Joi.string().isoDate().optional(),
  onlyAlerts: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

const timeRangeSchema = Joi.object({
  startTime: Joi.string().isoDate().required(),
  endTime: Joi.string().isoDate().required(),
  onlyAlerts: Joi.boolean().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '查询参数验证失败',
        errors: error.details.map(d => d.message)
      });
    }
    req.validatedQuery = value;
    next();
  };
}

router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await TraceService.getEventById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: '温度事件不存在'
      });
    }
    
    res.json({
      success: true,
      code: 'OK',
      data: event
    });
  } catch (err) {
    console.error('查询事件详情失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/order/:orderNumber', validateQuery(querySchema), async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const events = await TraceService.queryByOrder(orderNumber, req.validatedQuery);
    
    res.json({
      success: true,
      code: 'OK',
      data: {
        order_number: orderNumber,
        events,
        count: events.length
      }
    });
  } catch (err) {
    console.error('按订单查询失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/box/:boxNumber', validateQuery(querySchema), async (req, res) => {
  try {
    const { boxNumber } = req.params;
    const events = await TraceService.queryByBox(boxNumber, req.validatedQuery);
    
    res.json({
      success: true,
      code: 'OK',
      data: {
        box_number: boxNumber,
        events,
        count: events.length
      }
    });
  } catch (err) {
    console.error('按箱号查询失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/shift/:shiftName', validateQuery(querySchema), async (req, res) => {
  try {
    const { shiftName } = req.params;
    const events = await TraceService.queryByShift(shiftName, req.validatedQuery);
    
    res.json({
      success: true,
      code: 'OK',
      data: {
        shift_name: shiftName,
        events,
        count: events.length
      }
    });
  } catch (err) {
    console.error('按班次查询失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/time-range', validateQuery(timeRangeSchema), async (req, res) => {
  try {
    const { startTime, endTime, ...options } = req.validatedQuery;
    const events = await TraceService.queryByTimeRange(startTime, endTime, options);
    
    res.json({
      success: true,
      code: 'OK',
      data: {
        start_time: startTime,
        end_time: endTime,
        events,
        count: events.length
      }
    });
  } catch (err) {
    console.error('按时间范围查询失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/statistics', validateQuery(querySchema), async (req, res) => {
  try {
    const { startTime, endTime } = req.validatedQuery;
    const stats = await TraceService.getStatistics({ startTime, endTime });
    
    res.json({
      success: true,
      code: 'OK',
      data: stats
    });
  } catch (err) {
    console.error('查询统计数据失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
