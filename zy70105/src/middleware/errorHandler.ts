import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/errors';
import { ApiResponse } from '../types';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  const logger = req.logger;
  const requestId = req.requestId;

  let response: ApiResponse;
  let statusCode: number;

  if (err instanceof AppError) {
    logger.warn('Application error', {
      code: err.code,
      message: err.message,
      details: err.details
    });

    statusCode = getStatusCodeForErrorCode(err.code);
    response = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      timestamp: new Date(),
      requestId
    };
  } else {
    logger.error('Unhandled error', err);

    statusCode = 500;
    response = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: '服务器内部错误，请稍后重试'
      },
      timestamp: new Date(),
      requestId
    };
  }

  res.status(statusCode).json(response);
}

function getStatusCodeForErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.CONFLICT:
      return 409;
    case ErrorCode.BUSINESS_RULE_VIOLATION:
      return 422;
    case ErrorCode.INSUFFICIENT_INVENTORY:
      return 422;
    case ErrorCode.APPROVAL_FLOW_ERROR:
      return 422;
    case ErrorCode.INVALID_STATE_TRANSITION:
      return 422;
    case ErrorCode.TASK_EXECUTION_ERROR:
      return 500;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}

export function notFoundHandler(
  req: Request,
  res: Response
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由不存在: ${req.method} ${req.originalUrl}`
    },
    timestamp: new Date(),
    requestId: req.requestId
  };

  res.status(404).json(response);
}
