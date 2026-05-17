const Joi = require('joi');

const createTrialSchema = Joi.object({
  metricName: Joi.string().required().min(1).max(100)
    .messages({
      'any.required': '指标名称不能为空',
      'string.empty': '指标名称不能为空',
      'string.max': '指标名称不能超过100个字符'
    }),
  candidateThresholds: Joi.array().items(Joi.number().required())
    .min(1).max(20).required()
    .messages({
      'any.required': '候选阈值不能为空',
      'array.min': '至少需要提供1个候选阈值',
      'array.max': '最多支持20个候选阈值'
    }),
  historySamples: Joi.array().items(
    Joi.object({
      timestamp: Joi.string().isoDate().required(),
      value: Joi.number().required(),
      isRealIncident: Joi.boolean().default(false)
    })
  ).min(10).max(10000).required()
    .messages({
      'any.required': '历史样本不能为空',
      'array.min': '历史样本至少需要10条数据',
      'array.max': '历史样本最多支持10000条数据'
    }),
  createdBy: Joi.string().max(50).optional()
});

const advanceStatusSchema = Joi.object({
  targetStatus: Joi.string().valid('processing', 'calculated', 'confirming', 'completed').required()
    .messages({
      'any.required': '目标状态不能为空',
      'any.only': '不支持的目标状态'
    }),
  note: Joi.string().max(500).optional()
});

const falsePositiveSchema = Joi.object({
  thresholdId: Joi.string().required(),
  pointIndex: Joi.number().integer().min(0).required(),
  description: Joi.string().max(500).required()
});

const manualCorrectionSchema = Joi.object({
  field: Joi.string().required().valid('threshold', 'triggerCount', 'falsePositiveCount')
    .messages({
      'any.only': '不支持修正该字段'
    }),
  thresholdId: Joi.string().required(),
  oldValue: Joi.number().required(),
  newValue: Joi.number().required(),
  reason: Joi.string().max(500).required(),
  correctedBy: Joi.string().max(50).optional()
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const err = new Error('参数验证失败');
    err.statusCode = 400;
    err.errorCode = 'VALIDATION_ERROR';
    err.details = error.details.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
    err.processingBasis = '请求参数不符合预定义的验证规则';
    return next(err);
  }
  req.validatedBody = value;
  next();
};

module.exports = {
  validateCreateTrial: validate(createTrialSchema),
  validateAdvanceStatus: validate(advanceStatusSchema),
  validateFalsePositive: validate(falsePositiveSchema),
  validateManualCorrection: validate(manualCorrectionSchema)
};