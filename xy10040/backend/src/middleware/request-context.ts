import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext } from '../types';

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
      userId?: string;
    }
  }
}

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  req.context = {
    requestId,
    userId: req.userId,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
    userAgent: req.headers['user-agent'],
  };

  next();
}
