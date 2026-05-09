const express = require('express');
const Joi = require('joi');
const TemperatureService = require('../services/temperatureService');

const router = express.Router();

const singleEventSchema = Joi.object({
  box_number: Joi.string().required().messages({
    'string.empty': '箱号不能为空',
    'any.required': '箱号是必填项'
  }),
  temperature: Joi.number().required().messages({
    'number.base': '温度必须是数字',
    'any.required': '温度是必填项'
  }),
  event_time: Joi.string().isoDate().required().messages({
    'string.isoDate': '事件时间必须是有效的 ISO 日期格式',
    'any.required': '事件时间是必填项'
  }),
  order_number: Joi.string().optional()
});

const batchEventsSchema = Joi.object({
  events: Joi.array().items(singleEventSchema).min(1).required().messages({
    'array.min': '批量导入至少需要一条事件数据',
    'any.required': 'events 是必填项'
  })
});

function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        errors: error.details.map(d => d.message)
      });
    }
    next();
  };
}

router.post('/events', validateRequest(singleEventSchema), async (req, res) => {
  try {
    const result = await TemperatureService.processTemperatureEvent(req.body);
    
    if (!result.success && result.code === 'DUPLICATE_EVENT') {
      return res.status(409).json(result);
    }
    
    if (result.success && result.data && result.data.is_alert) {
      return res.status(201).json({
        ...result,
        message: '温度超标事件已记录，请及时处理'
      });
    }
    
    res.status(201).json(result);
  } catch (err) {
    console.error('处理温度事件失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.post('/events/batch', validateRequest(batchEventsSchema), async (req, res) => {
  try {
    const { events } = req.body;
    const result = await TemperatureService.processBatchEvents(events);
    
    res.status(201).json({
      success: true,
      code: 'BATCH_PROCESSED',
      message: `批量处理完成: 成功${result.success}条, 重复${result.duplicates}条, 告警${result.alerts}条`,
      data: result
    });
  } catch (err) {
    console.error('批量处理温度事件失败:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
