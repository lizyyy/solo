import { Response } from 'express';
import {
  BusinessError,
  ValidationError,
  NotFoundError,
  StateTransitionError,
  LockedError,
  IdempotencyError
} from './errors';

export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  timestamp: string;
  details?: Record<string, any>;
}

export function successResponse<T>(
  message: string,
  data?: T,
  details?: Record<string, any>
): ApiResponse<T> {
  return {
    success: true,
    code: 'SUCCESS',
    message,
    data,
    timestamp: new Date().toISOString(),
    details
  };
}

export function errorResponse(
  error: Error,
  defaultMessage: string = '操作失败'
): ApiResponse {
  if (error instanceof ValidationError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }

  if (error instanceof StateTransitionError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      details: {
        currentState: error.currentState,
        targetState: error.targetState
      },
      timestamp: new Date().toISOString()
    };
  }

  if (error instanceof LockedError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }

  if (error instanceof NotFoundError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }

  if (error instanceof IdempotencyError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }

  if (error instanceof BusinessError) {
    return {
      success: false,
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: false,
    code: 'INTERNAL_ERROR',
    message: defaultMessage,
    details: {
      error: error.message
    },
    timestamp: new Date().toISOString()
  };
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json(successResponse(message, data));
}

export function sendError(
  res: Response,
  error: Error,
  statusCode: number = 400
): Response {
  const response = errorResponse(error);
  return res.status(statusCode).json(response);
}
