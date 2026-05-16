const Joi = require('joi');

const schemas = {
  dataset: Joi.object({
    name: Joi.string().required().messages({
      'string.empty': '数据集名称不能为空',
      'any.required': '数据集名称是必填项'
    }),
    description: Joi.string().allow(''),
    data_source: Joi.string().allow(''),
    record_count: Joi.number().integer().min(0),
    fields: Joi.array().items(Joi.string())
  }),

  anonymizationRule: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(''),
    rule_type: Joi.string().valid('masking', 'encryption', 'generalization', 'suppression').required(),
    config: Joi.object().required(),
    created_by: Joi.string()
  }),

  riskSample: Joi.object({
    dataset_id: Joi.string().required(),
    sample_data: Joi.string().required(),
    risk_level: Joi.string().valid('high', 'medium', 'low').required(),
    risk_type: Joi.string(),
    identified_fields: Joi.array().items(Joi.string()),
    confidence_score: Joi.number().min(0).max(1)
  }),

  arbitrationOpinion: Joi.object({
    risk_sample_id: Joi.string().required(),
    arbitrator: Joi.string().required(),
    decision: Joi.string().valid('approve', 'reject', 'need_reprocess', 'escalate').required(),
    reason: Joi.string().required(),
    evidence: Joi.object()
  }),

  reprocessTask: Joi.object({
    dataset_id: Joi.string().required(),
    rule_id: Joi.string(),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
    original_input: Joi.alternatives().try(Joi.object(), Joi.array()).required(),
    processing_basis: Joi.object()
  }),

  statusUpdate: Joi.object({
    status: Joi.string().required()
  })
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: '验证失败',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }
    
    next();
  };
};

module.exports = { validate, schemas };