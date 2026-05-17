const Joi = require('joi');

const schemas = {
  createFreeze: Joi.object({
    orderNo: Joi.string().required().messages({
      'string.empty': '订单编号不能为空',
      'any.required': '订单编号是必填项'
    }),
    riskReason: Joi.string().required().messages({
      'string.empty': '风险原因不能为空',
      'any.required': '风险原因是必填项'
    }),
    freezeAction: Joi.string().required().messages({
      'string.empty': '冻结动作不能为空',
      'any.required': '冻结动作是必填项'
    }),
    freezeActionDetails: Joi.string().optional(),
    releaseCondition: Joi.string().optional(),
    processingBasis: Joi.string().optional(),
    originalInput: Joi.any().optional()
  }),

  submitForReview: Joi.object({
    reviewer: Joi.string().required().messages({
      'string.empty': '复核人不能为空',
      'any.required': '复核人是必填项'
    })
  }),

  releaseOrCancel: Joi.object({
    finalConclusion: Joi.string().required().messages({
      'string.empty': '最终结论不能为空',
      'any.required': '最终结论是必填项'
    })
  }),

  manualCorrect: Joi.object({
    riskReason: Joi.string().optional(),
    freezeAction: Joi.string().optional(),
    freezeActionDetails: Joi.string().optional(),
    releaseCondition: Joi.string().optional(),
    processingSummary: Joi.string().optional(),
    processingBasis: Joi.string().optional()
  }),

  intercept: Joi.object({
    orderNo: Joi.string().required().messages({
      'string.empty': '订单编号不能为空',
      'any.required': '订单编号是必填项'
    }),
    interceptType: Joi.string().required().messages({
      'string.empty': '拦截类型不能为空',
      'any.required': '拦截类型是必填项'
    }),
    requestData: Joi.any().optional()
  }),

  addSummary: Joi.object({
    summary: Joi.string().required().messages({
      'string.empty': '摘要内容不能为空',
      'any.required': '摘要内容是必填项'
    })
  }),

  recordException: Joi.object({
    errorInfo: Joi.any().required(),
    originalInput: Joi.any().optional()
  }),

  query: Joi.object({
    status: Joi.string().optional(),
    orderNo: Joi.string().optional(),
    reviewer: Joi.string().optional(),
    startTime: Joi.number().optional(),
    endTime: Joi.number().optional(),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20)
  })
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: '验证Schema不存在' });
    }

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({
        error: '请求参数验证失败',
        details: errors
      });
    }

    req.validatedData = value;
    next();
  };
};

const validateQuery = (req, res, next) => {
  const schema = schemas.query;
  const { error, value } = schema.validate(req.query, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return res.status(400).json({
      error: '查询参数验证失败',
      details: errors
    });
  }

  req.validatedQuery = value;
  next();
};

module.exports = { validate, validateQuery };
