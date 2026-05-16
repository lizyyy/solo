const Joi = require('joi');
const { StrategyStatus, DegradationLevel } = require('../models/constants');

const tenantScopeSchema = Joi.object({
  type: Joi.string().valid('all', 'include', 'exclude').required(),
  tenants: Joi.array().items(Joi.string())
});

const recoveryConditionSchema = Joi.object({
  type: Joi.string().valid('manual', 'time', 'threshold').required(),
  threshold: Joi.alternatives().conditional('type', {
    is: 'time',
    then: Joi.number().positive(),
    otherwise: Joi.alternatives().conditional('type', {
      is: 'threshold',
      then: Joi.object({
        metric: Joi.string().required(),
        value: Joi.number().required()
      }),
      otherwise: Joi.any()
    })
  })
});

const impactSummarySchema = Joi.object({
  totalApis: Joi.number().integer().min(0),
  affectedTenants: Joi.number().integer().min(0),
  estimatedRequests: Joi.number().integer().min(0),
  description: Joi.string().allow('')
});

const createStrategySchema = Joi.object({
  strategyName: Joi.string().min(3).max(100).required(),
  apiGroups: Joi.array().items(Joi.string()).min(1).required(),
  tenantScope: tenantScopeSchema.required(),
  degradationLevel: Joi.string().valid(...Object.values(DegradationLevel)).required(),
  recoveryCondition: recoveryConditionSchema.required(),
  impactSummary: impactSummarySchema,
  operator: Joi.string().required(),
  remarks: Joi.string().allow('')
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(StrategyStatus)).required(),
  operator: Joi.string().required(),
  reason: Joi.string().required()
});

const failurePathSchema = Joi.object({
  originalInput: Joi.any().required(),
  processingBasis: Joi.string().required(),
  finalConclusion: Joi.string().required()
});

const impactRecordSchema = Joi.object({
  tenantId: Joi.string().required(),
  apiPath: Joi.string().required(),
  requestCount: Joi.number().integer().min(1).default(1),
  impactType: Joi.string().valid('blocked', 'degraded', 'throttled').required()
});

const matchStrategySchema = Joi.object({
  apiGroup: Joi.string().required(),
  tenantId: Joi.string().required()
});

const exportSchema = Joi.object({
  format: Joi.string().valid('json', 'csv').default('json'),
  status: Joi.string().valid(...Object.values(StrategyStatus)),
  startDate: Joi.string().isoDate(),
  endDate: Joi.string().isoDate()
});

module.exports = {
  createStrategySchema,
  updateStatusSchema,
  failurePathSchema,
  impactRecordSchema,
  matchStrategySchema,
  exportSchema
};
