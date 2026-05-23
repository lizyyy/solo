import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
      requestTime: number;
    }
  }
}

export function requestTracker(req: Request, res: Response, next: NextFunction): void {
  req.traceId = uuidv4();
  req.requestTime = Date.now();
  
  res.setHeader('X-Trace-ID', req.traceId);
  
  console.log(`[${req.traceId}] ${req.method} ${req.path} - IP: ${req.ip}`);
  
  next();
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const duration = Date.now() - req.requestTime;
  
  console.error(`[${req.traceId}] ERROR: ${err.message} (${duration}ms)`);
  console.error(err.stack);
  
  res.status(500).json({
    success: false,
    error: err.message,
    traceId: req.traceId,
    timestamp: Date.now()
  });
}
