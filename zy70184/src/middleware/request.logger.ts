import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import dayjs from 'dayjs';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, path, ip, headers } = req;
  const operatorId = headers['x-operator-id'] as string | undefined;

  logger.info(`[REQUEST] ${method} ${path} - IP: ${ip} - Operator: ${operatorId || 'unknown'}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel](
      `[RESPONSE] ${method} ${path} - Status: ${statusCode} - Duration: ${duration}ms - ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    );
  });

  next();
};
