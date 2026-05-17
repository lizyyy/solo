import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { RecycleStatus } from '../types';

const grayScopeSchema = Joi.object({
  type: Joi.string().valid('percentage', 'tenant_list', 'tag').required(),
  value: Joi.alternatives().try(
    Joi.number().min(0).max(100),
    Joi.array().items(Joi.string())
  ).required()
});

const createRecycleSchema = Joi.object({
  configKey: Joi.string().required(),
  grayScope: grayScopeSchema.required(),
  owner: Joi.string().required(),
  recycleDate: Joi.date().iso().required(),
  hitTenants: Joi.array().items(Joi.string()).optional()
});

const queryRecycleSchema = Joi.object({
  configKey: Joi.string().optional(),
  owner: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(RecycleStatus)).optional(),
  page: Joi.number().min(1).optional(),
  pageSize: Joi.number().min(1).max(100).optional()
});

const statusTransitionSchema = Joi.object({
  status: Joi.string().valid(...Object.values(RecycleStatus)).required(),
  operator: Joi.string().required(),
  remark: Joi.string().optional()
});

const exceptionHandleSchema = Joi.object({
  handler: Joi.string().required(),
  resolution: Joi.string().required()
});

const manualCorrectionSchema = Joi.object({
  configKey: Joi.string().optional(),
  grayScope: grayScopeSchema.optional(),
  owner: Joi.string().optional(),
  recycleDate: Joi.date().iso().optional(),
  hitTenants: Joi.array().items(Joi.string()).optional(),
  operator: Joi.string().required(),
  reason: Joi.string().required()
});

export const validateCreateRecycle = (req: Request, res: Response, next: NextFunction) => {
  const { error } = createRecycleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateQueryRecycle = (req: Request, res: Response, next: NextFunction) => {
  const { error } = queryRecycleSchema.validate(req.query);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateStatusTransition = (req: Request, res: Response, next: NextFunction) => {
  const { error } = statusTransitionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateExceptionHandle = (req: Request, res: Response, next: NextFunction) => {
  const { error } = exceptionHandleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateManualCorrection = (req: Request, res: Response, next: NextFunction) => {
  const { error } = manualCorrectionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
