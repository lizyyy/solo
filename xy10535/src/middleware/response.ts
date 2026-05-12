import { generateId, now } from '../utils';
import type { ApiResponse } from '../types';
import type { Response } from 'express';

export function successResponse<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    requestId: requestId || generateId(),
    timestamp: now()
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: any,
  requestId?: string
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    requestId: requestId || generateId(),
    timestamp: now()
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  res.status(statusCode).json(successResponse(data));
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void {
  res.status(statusCode).json(errorResponse(code, message, details));
}
