import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message
  });
};

export const jsonParser = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers['content-type'] === 'application/json') {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        (req as any).body = JSON.parse(data || '{}');
        next();
      } catch (e) {
        res.status(400).json({
          success: false,
          error: 'INVALID_JSON',
          message: '请求体格式错误'
        });
      }
    });
  } else {
    (req as any).body = {};
    next();
  }
};
