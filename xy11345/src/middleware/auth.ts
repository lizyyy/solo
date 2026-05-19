import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-qc-key-2024';

export interface AuthRequest extends Request {
  user?: {
    role: 'admin' | 'operator' | 'qc';
    apiKey?: string;
  };
}

export function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required',
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
  }

  if (apiKey === ADMIN_API_KEY) {
    req.user = { role: 'admin', apiKey };
    return next();
  }

  if (apiKey.startsWith('op_')) {
    req.user = { role: 'operator', apiKey };
    return next();
  }

  if (apiKey.startsWith('qc_')) {
    req.user = { role: 'qc', apiKey };
    return next();
  }

  logger.warn('Invalid API key attempt', {
    ip: req.ip,
    requestId: req.headers['x-request-id'],
  });

  return res.status(403).json({
    success: false,
    message: 'Invalid API key',
    timestamp: Date.now(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required',
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
  }
  next();
}

export function requireQCOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'qc') {
    return res.status(403).json({
      success: false,
      message: 'QC or Admin privileges required',
      timestamp: Date.now(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
  }
  next();
}
