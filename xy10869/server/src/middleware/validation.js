const Joi = require('joi');

const schemas = {
  createMigrationScript: Joi.object({
    name: Joi.string().required().max(255),
    description: Joi.string().allow(''),
    content: Joi.string().required(),
    author: Joi.string().allow(''),
    version: Joi.string().allow(''),
    target_database_id: Joi.string().allow(null),
    rollback_script: Joi.string().allow('')
  }),

  createTargetDatabase: Joi.object({
    name: Joi.string().required().max(255),
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).required(),
    database_name: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().allow(''),
    type: Joi.string().valid('mysql', 'postgresql', 'sqlite').default('mysql'),
    environment: Joi.string().valid('production', 'staging', 'development', 'test').required()
  }),

  createPreviewBatch: Joi.object({
    migration_script_id: Joi.string().required(),
    target_database_id: Joi.string().required(),
    operator: Joi.string().allow(''),
    remarks: Joi.string().allow('')
  }),

  updateBatchStatus: Joi.object({
    status: Joi.string().valid(
      'pending',
      'running',
      'completed',
      'failed',
      'waiting_confirmation',
      'confirmed',
      'rollback_required',
      'rolled_back',
      'compensated'
    ).required(),
    operator: Joi.string().allow(''),
    remarks: Joi.string().allow('')
  }),

  createCompensationAction: Joi.object({
    action_type: Joi.string().valid(
      'manual_fix',
      'rollback_script',
      'data_restore',
      'skip_and_continue',
      'other'
    ).required(),
    action_content: Joi.string().required(),
    remarks: Joi.string().allow('')
  }),

  executeCompensation: Joi.object({
    executed_by: Joi.string().required(),
    result: Joi.string().required()
  }),

  queryBatches: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    page_size: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().allow(''),
    migration_script_id: Joi.string().allow(''),
    target_database_id: Joi.string().allow(''),
    start_date: Joi.string().allow(''),
    end_date: Joi.string().allow('')
  }),

  rollbackValidation: Joi.object({
    status: Joi.string().valid('passed', 'failed', 'pending').required(),
    validation_result: Joi.string().required(),
    validated_by: Joi.string().required(),
    remarks: Joi.string().allow('')
  })
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: '验证配置错误',
        message: `未找到验证 schema: ${schemaName}`
      });
    }

    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }

    req.validatedBody = value;
    next();
  };
};

const validateQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        error: '验证配置错误',
        message: `未找到验证 schema: ${schemaName}`
      });
    }

    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }

    req.validatedQuery = value;
    next();
  };
};

module.exports = { validate, validateQuery };
