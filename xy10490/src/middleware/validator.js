const Joi = require('joi');

const equipmentCreateSchema = Joi.object({
  equipmentId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  productionLine: Joi.string().required(),
  location: Joi.string().allow('').optional(),
  initialRunningHours: Joi.number().integer().min(0).default(0),
  maintenanceCycleType: Joi.string().valid('hour', 'date').required(),
  maintenanceCycleValue: Joi.number().integer().positive().required(),
  status: Joi.string().valid('active', 'inactive', 'maintenance').default('active')
});

const hourReportSchema = Joi.object({
  runningHours: Joi.number().integer().min(0).required(),
  reportTime: Joi.date().optional(),
  reportedBy: Joi.string().optional(),
  notes: Joi.string().optional()
});

const completeMaintenanceSchema = Joi.object({
  completedBy: Joi.string().required(),
  notes: Joi.string().optional()
});

const skipRequestSchema = Joi.object({
  reason: Joi.string().required(),
  requestedBy: Joi.string().required()
});

const approveSkipSchema = Joi.object({
  approvedBy: Joi.string().required(),
  approvalNotes: Joi.string().optional()
});

const catchupSchema = Joi.object({
  completedBy: Joi.string().required(),
  notes: Joi.string().optional()
});

const downtimeImpactSchema = Joi.object({
  startTime: Joi.date().required(),
  endTime: Joi.date().optional(),
  impactDescription: Joi.string().required(),
  estimatedLoss: Joi.number().min(0).optional(),
  reportedBy: Joi.string().optional()
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: error.details.map(d => d.message
      });
    }
    next();
  };
};

module.exports = {
  equipmentCreateSchema,
  hourReportSchema,
  completeMaintenanceSchema,
  skipRequestSchema,
  approveSkipSchema,
  catchupSchema,
  downtimeImpactSchema,
  validate
};
