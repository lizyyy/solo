import { Request, Response, NextFunction } from 'express';
import { CertificateError } from '../services/certificateService';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err instanceof CertificateError) {
    res.status(400).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        suggestion: err.suggestion,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      suggestion: 'retry' as const,
    },
  });
}
