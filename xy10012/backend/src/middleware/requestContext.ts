import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    }
  }
}

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.context = new RequestContext({
    requestId: (req.headers['x-request-id'] as string) || uuidv4(),
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.setHeader('X-Request-Id', req.context.requestId);
  next();
};