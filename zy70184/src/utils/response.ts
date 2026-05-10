import { Response } from 'express';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: Record<string, unknown>
): Response => {
  const response: ApiResponse<never> = {
    success: false,
    message,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(response);
};

export const paginationResponse = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message?: string
): Response => {
  const totalPages = Math.ceil(total / pageSize);
  return successResponse(
    res,
    {
      items: data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
    message
  );
};
