const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => detail.message);
    return res.status(400).json({ success: false, message: '参数验证失败', errors });
  }
  next();
};

const schemas = {
  batch: Joi.object({
    batch_name: Joi.string().required(),
    inspection_type: Joi.string().valid('routine', 'special', 'emergency').required(),
    start_date: Joi.date().required(),
    end_date: Joi.date(),
    inspector: Joi.string(),
    remarks: Joi.string().allow('')
  }),

  inspectionItem: Joi.object({
    batch_id: Joi.number().integer().required(),
    check_content: Joi.string().required(),
    risk_level_id: Joi.number().integer().required(),
    rectifier: Joi.string().required(),
    rectify_deadline: Joi.date().required(),
    source_type: Joi.string().valid('screenshot', 'table', 'manual', 'other'),
    source_ref: Joi.string(),
    raw_input: Joi.string()
  }),

  statusUpdate: Joi.object({
    status: Joi.string().valid('pending', 'in_rectification', 'rectified', 'reviewing', 'closed', 'reopened').required(),
    operator: Joi.string().required(),
    reason: Joi.string()
  }),

  rectification: Joi.object({
    item_id: Joi.number().integer().required(),
    rectify_content: Joi.string().required(),
    rectifier: Joi.string().required(),
    rectify_date: Joi.date().required(),
    evidences: Joi.string()
  }),

  review: Joi.object({
    item_id: Joi.number().integer().required(),
    reviewer: Joi.string().required(),
    review_date: Joi.date().required(),
    review_conclusion: Joi.string().valid('passed', 'failed', 'need_rework').required(),
    review_opinion: Joi.string()
  }),

  manualCorrection: Joi.object({
    item_id: Joi.number().integer().required(),
    field_name: Joi.string().required(),
    new_value: Joi.string().required(),
    corrector: Joi.string().required(),
    correction_reason: Joi.string().required()
  }),

  exceptionHandle: Joi.object({
    handler: Joi.string().required(),
    handling_basis: Joi.string().required(),
    status: Joi.string().valid('resolved', 'rejected').required()
  })
};

module.exports = { validate, schemas };
