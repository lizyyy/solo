const Joi = require('joi');

const apiEntrySchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().allow('').max(500),
  endpoint: Joi.string().required().pattern(/^\/api/),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
  owner_id: Joi.number().integer().positive(),
  permission_level: Joi.string().valid('public', 'internal', 'confidential', 'restricted').default('internal'),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).default('1.0.0')
});

const statusTransitionSchema = Joi.object({
  new_status: Joi.string().valid('draft', 'reviewing', 'active', 'deprecated', 'archived').required(),
  changed_by: Joi.string().email().required(),
  reason: Joi.string().required().min(5)
});

const exampleRequestSchema = Joi.object({
  title: Joi.string().required().min(2).max(100),
  request_body: Joi.string().allow(''),
  response_body: Joi.string().allow(''),
  headers: Joi.string().allow('')
});

const validateApiEntry = (req, res, next) => {
  const { error } = apiEntrySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

const validateStatusTransition = (req, res, next) => {
  const { error } = statusTransitionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

const validateExampleRequest = (req, res, next) => {
  const { error } = exampleRequestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(d => d.message)
    });
  }
  next();
};

module.exports = {
  validateApiEntry,
  validateStatusTransition,
  validateExampleRequest
};
