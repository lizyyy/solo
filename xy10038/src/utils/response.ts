import { Response } from 'express';
import { PaginatedResult } from '../types';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginatedResult<T>['pagination'];
  timestamp: string;
}

export function successResponse<T>(
  res: Response,
  data: T,
  message = '操作成功',
  pagination?: PaginatedResult<T>['pagination']
): Response {
  return res.status(200).json({
    success: true,
    data,
    message,
    pagination,
    timestamp: new Date().toISOString()
  });
}

export function createdResponse<T>(
  res: Response,
  data: T,
  message = '创建成功'
): Response {
  return res.status(201).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

export function noContentResponse(res: Response): Response {
  return res.status(204).send();
}

export function errorResponse(
  res: Response,
  statusCode: number,
  message: string,
  error?: string
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
    timestamp: new Date().toISOString()
  });
}
