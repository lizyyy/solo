import { Request, Response, NextFunction } from 'express';
import { AppError, ConcurrencyError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.context?.requestId;

  if (err instanceof AppError) {
    logger.warn('App error', {
      requestId,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details,
    });

    if (err instanceof ConcurrencyError) {
      res.setHeader('Retry-After', '1');
    }

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
        requestId,
      },
    });
  }

  logger.error('Unexpected error', {
    requestId,
    error: err.message,
    stack: err.stack,
  });

  return res.status(500).json({
    error: {
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId,
    },
  });
}

export function notFoundHandler(
  req: Request,
  res: Response
) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.path}`,
      code: 'NOT_FOUND',
      requestId: req.context?.requestId,
    },
  });
}
