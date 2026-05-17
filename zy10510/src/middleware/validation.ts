import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ArbitrationStatus } from '../types';
import { AppError } from './errorHandler';

const reportCaliberSchema = Joi.object({
  reportName: Joi.string().required().trim().min(1).max(200),
  calculation: Joi.string().required().trim().min(1).max(2000),
  description: Joi.string().trim().max(1000).optional()
});

const createArbitrationSchema = Joi.object({
  fieldName: Joi.string().required().trim().min(1).max(200),
  sourceReports: Joi.array().items(reportCaliberSchema).min(1).required(),
  disputeDescription: Joi.string().required().trim().min(1).max(5000),
  createdBy: Joi.string().required().trim().min(1).max(200),
  rawInput: Joi.any().optional()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(ArbitrationStatus)).required(),
  updatedBy: Joi.string().required().trim().min(1).max(200),
  remark: Joi.string().trim().max(1000).optional(),
  arbitrationOpinion: Joi.string().trim().max(5000).optional(),
  effectiveVersion: Joi.string().trim().max(100).optional(),
  handlingBasis: Joi.string().trim().max(2000).optional()
});

const correctionSchema = Joi.object({
  field: Joi.string().required().trim().min(1).max(200),
  newValue: Joi.any().required(),
  reason: Joi.string().required().trim().min(1).max(2000),
  correctedBy: Joi.string().required().trim().min(1).max(200)
});

const querySchema = Joi.object({
  fieldName: Joi.string().trim().max(200).optional(),
  status: Joi.string().valid(...Object.values(ArbitrationStatus)).optional(),
  createdBy: Joi.string().trim().max(200).optional(),
  page: Joi.number().integer().min(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional()
});

const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new AppError(400, 'VALIDATION_ERROR', '请求参数验证失败', errors));
    }

    req.body = value;
    next();
  };
};

const createQueryValidator = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new AppError(400, 'VALIDATION_ERROR', '查询参数验证失败', errors));
    }

    req.query = value;
    next();
  };
};

export const validateCreateArbitration = validate(createArbitrationSchema);
export const validateUpdateStatus = validate(updateStatusSchema);
export const validateCorrection = validate(correctionSchema);
export const validateQuery = createQueryValidator(querySchema);
