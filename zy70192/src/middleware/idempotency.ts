import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { errorResponse, AppError, errorCodes } from '../utils/response';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const EXPIRY_HOURS = 24;

interface IdempotentKey {
  id: string;
  key: string;
  requestPath: string;
  requestBody: string | null;
  response: string | null;
  createdAt: string;
  expiresAt: string;
}

export const idempotencyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.header(IDEMPOTENCY_HEADER);

  if (!idempotencyKey) {
    return next();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
  const requestBody = Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null;

  const existing = db.prepare(`
    SELECT * FROM idempotency_keys WHERE key = ?
  `).get(idempotencyKey) as IdempotentKey | undefined;

  if (existing) {
    if (existing.response) {
      const cachedResponse = JSON.parse(existing.response);
      return res.status(cachedResponse.status || 200).json(cachedResponse.body);
    }

    if (existing.requestPath !== req.path || existing.requestBody !== requestBody) {
      return res.status(409).json(errorResponse(
        '幂等键已被用于不同的请求',
        errorCodes.IDEMPOTENT_CONFLICT
      ));
    }

    return next();
  }

  db.prepare(`
    INSERT INTO idempotency_keys (id, key, request_path, request_body, response, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    idempotencyKey,
    req.path,
    requestBody,
    null,
    now.toISOString(),
    expiresAt.toISOString()
  );

  const originalSend = res.json.bind(res);
  res.json = (body: any) => {
    db.prepare(`
      UPDATE idempotency_keys
      SET response = ?
      WHERE key = ?
    `).run(
      JSON.stringify({ status: res.statusCode, body }),
      idempotencyKey
    );
    return originalSend(body);
  };

  next();
};

export const cleanupExpiredKeys = (): void => {
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM idempotency_keys WHERE expires_at < ?`).run(now);
  console.log('Cleaned up expired idempotency keys');
};
