import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../types';
import { db } from '../database';

export const responseHandler = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  (req as any).requestId = requestId;

  res.success = <T>(data: T, message?: string) => {
    const response: ApiResponse<T> = {
      success: true,
      data,
      requestId,
      timestamp: db.getTimestamp()
    };
    res.json(response);
  };

  res.error = (code: string, message: string, details?: any) => {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details
      },
      requestId,
      timestamp: db.getTimestamp()
    };
    res.status(400).json(response);
  };

  res.notFound = (message: string = '资源不存在') => {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message
      },
      requestId,
      timestamp: db.getTimestamp()
    };
    res.status(404).json(response);
  };

  next();
};

declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, message?: string): void;
      error(code: string, message: string, details?: any): void;
      notFound(message?: string): void;
    }
  }
}
