const Joi = require('joi');

const refundCreateSchema = Joi.object({
  machine_id: Joi.string().required().messages({
    'string.empty': '机器编号不能为空',
    'any.required': '机器编号是必填项'
  }),
  payment_id: Joi.string().required().messages({
    'string.empty': '支付流水号不能为空',
    'any.required': '支付流水号是必填项'
  }),
  start_event_id: Joi.string().optional(),
  fault_code: Joi.string().optional(),
  fault_screenshot: Joi.string().optional(),
  applicant_name: Joi.string().optional(),
  applicant_phone: Joi.string().optional(),
  reason: Joi.string().optional(),
  amount: Joi.number().positive().required().messages({
    'number.base': '金额必须是数字',
    'number.positive': '金额必须大于0',
    'any.required': '退款金额是必填项'
  })
});

const refundStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'verifying', 'approved', 'rejected', 'refunding', 'completed', 'failed').required().messages({
    'any.only': '无效的状态值',
    'any.required': '目标状态是必填项'
  }),
  operator: Joi.string().optional().default('system'),
  remarks: Joi.string().optional()
});

const manualCorrectSchema = Joi.object({
  amount: Joi.number().positive().optional(),
  fault_code: Joi.string().optional(),
  reason: Joi.string().optional(),
  applicant_name: Joi.string().optional(),
  applicant_phone: Joi.string().optional(),
  operator: Joi.string().required().messages({
    'any.required': '操作人是必填项'
  })
});

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details
      });
    }
    req.validatedData = value;
    next();
  };
};

module.exports = {
  validateRequest,
  refundCreateSchema,
  refundStatusSchema,
  manualCorrectSchema
};
