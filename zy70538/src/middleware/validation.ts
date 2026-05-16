import Joi from 'joi';
import { CacheExplanationStatus } from '../types';

export const createExplanationSchema = Joi.object({
  apiPath: Joi.string().required().uri({ allowRelative: true }),
  cacheKey: Joi.string().required(),
  cacheKeyCalculation: Joi.object({
    algorithm: Joi.string().required(),
    factors: Joi.array().items(Joi.string()).required(),
    rawValue: Joi.string().required()
  }).required(),
  matchedRule: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string().required(),
    ttl: Joi.number().integer().min(0).required(),
    priority: Joi.number().integer().min(0).required(),
    conditions: Joi.array().items(Joi.object({
      field: Joi.string().required(),
      operator: Joi.string().required(),
      value: Joi.string().required()
    })).required()
  }).required(),
  ttlSeconds: Joi.number().integer().min(0).required(),
  expirationConditions: Joi.array().items(Joi.string()).required(),
  explanationReport: Joi.object({
    summary: Joi.string().required(),
    details: Joi.array().items(Joi.string()).required(),
    recommendations: Joi.string().optional()
  }).required(),
  createdBy: Joi.string().optional()
});

export const manualCorrectionSchema = Joi.object({
  explanationId: Joi.string().required(),
  newStatus: Joi.string().valid(...Object.values(CacheExplanationStatus)).required(),
  reason: Joi.string().required(),
  correctedBy: Joi.string().required(),
  overrideTtl: Joi.number().integer().min(0).optional()
});

export const forceRefreshSchema = Joi.object({
  cacheKey: Joi.string().required(),
  reason: Joi.string().required(),
  refreshedBy: Joi.string().required()
});

export const querySchema = Joi.object({
  apiPath: Joi.string().optional(),
  cacheKey: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(CacheExplanationStatus)).optional(),
  ruleId: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional()
});

export const recordHitSchema = Joi.object({
  cacheKey: Joi.string().required(),
  requestId: Joi.string().required(),
  clientIp: Joi.string().ip().optional()
});

export const recordFailureSchema = Joi.object({
  id: Joi.string().required(),
  rawInput: Joi.object().required(),
  processingBasis: Joi.array().items(Joi.string()).required(),
  finalConclusion: Joi.string().required(),
  errorStack: Joi.string().optional()
});
