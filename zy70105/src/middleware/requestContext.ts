import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLoggerContext, LoggerContext } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: LoggerContext;
      startTime: number;
    }
  }
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const logger = createLoggerContext(requestId);
  
  req.requestId = requestId;
  req.logger = logger;
  req.startTime = Date.now();

  res.setHeader('X-Request-Id', requestId);
  
  logger.info('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration
    });
  });

  next();
}
