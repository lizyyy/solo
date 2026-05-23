import { Request, Response, NextFunction } from 'express';
import { logError } from '../services/logger';
import { generateId } from '../utils';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const traceId = generateId();
  
  logError(`Unhandled error: ${err.message}`, err, {
    path: req.path,
    method: req.method,
    body: req.body,
  }, traceId);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    traceId,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`,
  });
};

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message,
      });
      return;
    }
    next();
  };
};
