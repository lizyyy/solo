const Joi = require('joi');

const experimentSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.base': '实验名称必须是字符串',
      'string.empty': '实验名称不能为空',
      'string.min': '实验名称至少1个字符',
      'string.max': '实验名称最多100个字符',
      'any.required': '实验名称是必填项'
    }),
  
  description: Joi.string()
    .max(500)
    .default('')
    .messages({
      'string.base': '描述必须是字符串',
      'string.max': '描述最多500个字符'
    }),
  
  seed: Joi.number()
    .integer()
    .min(0)
    .default(Date.now())
    .messages({
      'number.base': '种子值必须是数字',
      'number.integer': '种子值必须是整数',
      'number.min': '种子值不能为负数'
    }),
  
  connections: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(10)
    .messages({
      'number.base': '连接数必须是数字',
      'number.integer': '连接数必须是整数',
      'number.min': '连接数至少为1',
      'number.max': '连接数最多为10000'
    }),
  
  readEvents: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(100)
    .messages({
      'number.base': '读事件数必须是数字',
      'number.integer': '读事件数必须是整数',
      'number.min': '读事件数不能为负数',
      'number.max': '读事件数最多为100000'
    }),
  
  writeEvents: Joi.number()
    .integer()
    .min(0)
    .max(100000)
    .default(50)
    .messages({
      'number.base': '写事件数必须是数字',
      'number.integer': '写事件数必须是整数',
      'number.min': '写事件数不能为负数',
      'number.max': '写事件数最多为100000'
    }),
  
  callbackDelay: Joi.number()
    .integer()
    .min(0)
    .max(10000)
    .default(10)
    .messages({
      'number.base': '回调延迟必须是数字',
      'number.integer': '回调延迟必须是整数',
      'number.min': '回调延迟不能为负数',
      'number.max': '回调延迟最多为10000ms'
    }),
  
  readTimeout: Joi.number()
    .integer()
    .min(100)
    .max(60000)
    .default(5000)
    .messages({
      'number.base': '读超时必须是数字',
      'number.integer': '读超时必须是整数',
      'number.min': '读超时至少为100ms',
      'number.max': '读超时最多为60000ms'
    }),
  
  writeTimeout: Joi.number()
    .integer()
    .min(100)
    .max(60000)
    .default(5000)
    .messages({
      'number.base': '写超时必须是数字',
      'number.integer': '写超时必须是整数',
      'number.min': '写超时至少为100ms',
      'number.max': '写超时最多为60000ms'
    }),
  
  failureRate: Joi.number()
    .min(0)
    .max(1)
    .default(0)
    .messages({
      'number.base': '失败率必须是数字',
      'number.min': '失败率不能小于0',
      'number.max': '失败率不能大于1'
    }),
  
  threadPoolSize: Joi.number()
    .integer()
    .min(1)
    .max(32)
    .default(4)
    .messages({
      'number.base': '线程池大小必须是数字',
      'number.integer': '线程池大小必须是整数',
      'number.min': '线程池大小至少为1',
      'number.max': '线程池大小最多为32'
    }),
  
  handlers: Joi.array()
    .items(Joi.object({
      name: Joi.string().required(),
      eventType: Joi.string().required()
    }))
    .default([])
    .messages({
      'array.base': 'handlers必须是数组'
    })
});

function validateExperimentConfig(config) {
  const { error, value } = experimentSchema.validate(config, {
    abortEarly: false,
    convert: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));

    return {
      valid: false,
      errors,
      hints: generateHints(errors)
    };
  }

  const additionalErrors = validateBusinessRules(value);
  if (additionalErrors.length > 0) {
    return {
      valid: false,
      errors: additionalErrors,
      hints: generateHints(additionalErrors)
    };
  }

  return {
    valid: true,
    value,
    errors: [],
    hints: []
  };
}

function validateBusinessRules(config) {
  const errors = [];

  if (config.readEvents === 0 && config.writeEvents === 0) {
    errors.push({
      field: 'readEvents,writeEvents',
      message: '读事件数和写事件数不能同时为0',
      value: { readEvents: config.readEvents, writeEvents: config.writeEvents }
    });
  }

  const totalEvents = config.connections * (config.readEvents + config.writeEvents);
  if (totalEvents > 1000000) {
    errors.push({
      field: 'connections,readEvents,writeEvents',
      message: `总事件数(${totalEvents})超过限制(1,000,000)`,
      value: totalEvents
    });
  }

  if (config.callbackDelay > 100 && (config.readEvents + config.writeEvents) > 1000) {
    errors.push({
      field: 'callbackDelay',
      message: '回调延迟过长会导致实验执行时间过长，建议减少延迟或事件数',
      value: config.callbackDelay,
      warning: true
    });
  }

  return errors;
}

function generateHints(errors) {
  const hints = [];
  
  errors.forEach(err => {
    if (err.field.includes('connections')) {
      hints.push({
        field: err.field,
        hint: '连接数建议在1-1000之间，过高可能导致内存问题'
      });
    }
    if (err.field.includes('failureRate')) {
      hints.push({
        field: err.field,
        hint: '失败率是0到1之间的小数，例如0.1表示10%的失败率'
      });
    }
    if (err.field.includes('timeout')) {
      hints.push({
        field: err.field,
        hint: '超时时间以毫秒为单位，建议设置在100-30000ms之间'
      });
    }
    if (err.field.includes('readEvents') || err.field.includes('writeEvents')) {
      hints.push({
        field: err.field,
        hint: '每个连接会产生读/写事件，总事件数 = 连接数 * (读事件数 + 写事件数)'
      });
    }
  });

  return hints;
}

const validEventTypes = [
  'connection_accepted',
  'connection_closed',
  'read_ready',
  'write_ready',
  'read_completed',
  'write_completed',
  'read_timeout',
  'write_timeout',
  'error'
];

function validateHandler(eventType) {
  return validEventTypes.includes(eventType);
}

module.exports = {
  validateExperimentConfig,
  validateHandler,
  validEventTypes
};
