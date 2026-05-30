import { type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AuditLog } from '../../shared/types.js';
import { AuditRepo } from '../repositories/AuditRepo.js';

const auditRepo = new AuditRepo();

function parseEntityType(path: string): AuditLog['entityType'] | null {
  if (path.includes('/tracks')) return 'track';
  if (path.includes('/votes')) return 'vote';
  if (path.includes('/copyrights')) return 'copyright';
  if (path.includes('/decisions')) return 'decision';
  return null;
}

function parseAction(method: string): AuditLog['action'] | null {
  switch (method) {
    case 'POST':
      return 'create';
    case 'PUT':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return null;
  }
}

function parseEntityId(path: string): string | undefined {
  const match = path.match(/\/([a-f0-9-]{36})/i);
  return match ? match[1] : undefined;
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const { method, path, ip, headers } = req;
  const operator = headers['x-operator'] as string | undefined;

  if (!['POST', 'PUT', 'DELETE'].includes(method)) {
    next();
    return;
  }

  const entityType = parseEntityType(path);
  const action = parseAction(method);

  if (!entityType || !action) {
    next();
    return;
  }

  const entityId = parseEntityId(path);
  const beforeChange = req.body ? { ...req.body } : undefined;

  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  let responseBody: any;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend(body);
  };

  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let afterChange: any;
      if (responseBody) {
        try {
          afterChange = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
        } catch {
          afterChange = responseBody;
        }
      }

      const log: Omit<AuditLog, 'timestamp'> = {
        id: uuidv4(),
        action,
        entityType,
        entityId,
        beforeChange,
        afterChange,
        operator: operator || 'unknown',
        ip,
      };

      try {
        auditRepo.create(log);
      } catch (err) {
        console.error('Failed to create audit log:', err);
      }
    }
  });

  next();
}

export default auditLogger;
