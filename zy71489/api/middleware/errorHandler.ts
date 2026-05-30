import { type Request, type Response, type NextFunction } from 'express';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  path: string;
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error Stack:', error.stack);
  console.error('Error Message:', error.message);

  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    statusCode = 400;
    message = 'Invalid JSON payload';
    code = 'INVALID_JSON';
  } else if (error.message.includes('not found') || error.message.includes('Not Found')) {
    statusCode = 404;
    message = error.message;
    code = 'NOT_FOUND';
  } else if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
    statusCode = 401;
    message = error.message;
    code = 'UNAUTHORIZED';
  } else if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
    statusCode = 403;
    message = error.message;
    code = 'FORBIDDEN';
  } else if (error.message.includes('duplicate') || error.message.includes('Duplicate')) {
    statusCode = 409;
    message = error.message;
    code = 'DUPLICATE_ENTRY';
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code,
      details,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(`API not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND');
  next(error);
}

export default errorHandler;
