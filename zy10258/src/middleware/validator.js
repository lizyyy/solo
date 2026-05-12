const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }
    next();
  };
};

const schemas = {
  inStock: Joi.object({
    waybill_no: Joi.string().required().trim(),
    receiver_name: Joi.string().required().trim(),
    receiver_phone: Joi.string().required().trim(),
    operator: Joi.string().trim().default('system')
  }),

  pickup: Joi.object({
    waybill_no: Joi.string().required().trim(),
    operator: Joi.string().trim().default('system')
  }),

  reportException: Joi.object({
    waybill_no: Joi.string().required().trim(),
    exception_type: Joi.string().required().valid('damaged', 'lost', 'wrong_pickup', 'other').trim(),
    exception_desc: Joi.string().trim().allow(''),
    operator: Joi.string().trim().default('system')
  }),

  confirmResponsibility: Joi.object({
    exception_id: Joi.number().integer().required(),
    responsible_party: Joi.string().required().valid('courier', 'station', 'receiver', 'other').trim(),
    operator: Joi.string().trim().default('system')
  }),

  closeException: Joi.object({
    exception_id: Joi.number().integer().required(),
    operator: Joi.string().trim().default('system')
  }),

  compensation: Joi.object({
    exception_id: Joi.number().integer().required(),
    amount: Joi.number().positive().required(),
    compensation_reason: Joi.string().trim().allow(''),
    operator: Joi.string().trim().default('system')
  }),

  dailyReport: Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
  })
};

module.exports = {
  validate,
  schemas
};
