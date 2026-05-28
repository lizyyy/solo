import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';

export const auditLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const originalSend = res.send.bind(res);

  res.send = ((body: unknown) => {
    const duration = Date.now() - startTime;
    const method = req.method;
    const path = req.path;
    const ip = req.headers['x-forwarded-for'] as string || req.ip || '';
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    let responseBody: unknown;
    try {
      if (typeof body === 'string') {
        responseBody = JSON.parse(body);
      } else {
        responseBody = body;
      }
    } catch {
      responseBody = { raw: String(body).substring(0, 100) };
    }

    const resourceMatch = path.match(/^\/api\/([^/]+)/);
    const resource = resourceMatch ? resourceMatch[1] : 'unknown';

    let action = `${method.toLowerCase()}_${resource}`;
    let resourceId: string | undefined;

    const idMatch = path.match(/\/([^/]+)$/);
    if (idMatch && idMatch[1] !== resource && !idMatch[1].includes('?')) {
      resourceId = idMatch[1];
    }

    let status: number;
    try {
      status = res.statusCode;
    } catch {
      status = 200;
    }

    const details: Record<string, unknown> = {
      method,
      path,
      status,
      durationMs: duration,
      userAgent: req.headers['user-agent'],
    };

    if (method === 'POST' || method === 'PUT') {
      const bodyToLog = { ...req.body };
      if (bodyToLog.password) delete bodyToLog.password;
      if (bodyToLog.token) delete bodyToLog.token;
      details.requestBody = bodyToLog;
    }

    if (status >= 400 && responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
      details.error = (responseBody as { error: unknown }).error;
    }

    db.addAuditLog({
      action,
      resource,
      resourceId,
      userId,
      ip,
      details,
    }).catch((err) => {
      console.error('Failed to save audit log:', err);
    });

    return originalSend(body);
  }) as typeof res.send;

  next();
};
