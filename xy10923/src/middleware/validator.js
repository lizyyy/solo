const Joi = require('joi');

const schemas = {
  createDetour: Joi.object({
    route_id: Joi.string().required().messages({ 'any.required': '线路ID必填' }),
    reason_id: Joi.string().required().messages({ 'any.required': '改线原因ID必填' }),
    plan_date: Joi.string().required().messages({ 'any.required': '改线日期必填' }),
    start_time: Joi.string().optional(),
    end_time: Joi.string().optional(),
    estimated_delay: Joi.number().optional(),
    operator: Joi.string().optional(),
    remark: Joi.string().optional(),
    stop_replacements: Joi.array().items(Joi.object({
      original_stop_id: Joi.string().required(),
      temp_stop_id: Joi.string().required(),
      new_arrival_time: Joi.string().optional()
    })).optional()
  }),

  statusTransition: Joi.object({
    target_status: Joi.string().valid('draft', 'pending', 'in_progress', 'delayed', 'completed', 'cancelled').required(),
    operator: Joi.string().optional(),
    remark: Joi.string().optional()
  }),

  parentReceipt: Joi.object({
    detour_plan_id: Joi.string().required(),
    student_id: Joi.string().required(),
    parent_phone: Joi.string().required(),
    confirm_type: Joi.string().valid('confirmed', 'rejected', 'pending').required(),
    message: Joi.string().optional(),
    is_late: Joi.boolean().optional(),
    late_reason: Joi.string().optional(),
    source: Joi.string().optional()
  }),

  manualCorrect: Joi.object({
    plan_date: Joi.string().optional(),
    start_time: Joi.string().optional(),
    end_time: Joi.string().optional(),
    estimated_delay: Joi.number().optional(),
    remark: Joi.string().optional(),
    status: Joi.string().optional(),
    operator: Joi.string().required()
  })
};

const validate = (schemaName) => (req, res, next) => {
  const schema = schemas[schemaName];
  if (!schema) {
    return next(new Error('验证schema不存在'));
  }

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message).join('; ');
    const err = new Error(errorMessages);
    err.statusCode = 400;
    return next(err);
  }
  next();
};

module.exports = validate;
