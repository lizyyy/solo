import { Request, Response, NextFunction } from 'express';
import { db } from '../database';

export const idempotentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  
  if (!requestId) {
    return res.error('MISSING_REQUEST_ID', '请在请求头中提供 x-request-id');
  }

  const existingRequest = db.getIdempotentRequest(requestId);
  
  if (existingRequest) {
    return res.json(existingRequest.response);
  }

  const originalJson = res.json.bind(res);
  
  res.json = (body: any) => {
    db.saveIdempotentRequest({
      requestId,
      endpoint: req.path,
      payload: req.body,
      response: body,
      createdAt: db.getTimestamp()
    });
    return originalJson(body);
  };

  next();
};
