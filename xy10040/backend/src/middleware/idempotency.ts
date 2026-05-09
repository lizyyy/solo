import { Request, Response, NextFunction } from 'express';
import { idempotencyService } from '../services/idempotency.service';
import { IdempotencyConflict } from '../utils/errors';
import { logger } from '../utils/logger';

const IDEMPOTENCY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!IDEMPOTENCY_METHODS.has(req.method)) {
    return next();
  }

  const idempotencyToken = req.headers['x-idempotency-token'] as string;

  if (!idempotencyToken) {
    return next();
  }

  const userId = req.userId || 'anonymous';

  idempotencyService
    .checkAndCreate(idempotencyToken, userId, req.path, req.body)
    .then(({ isDuplicate, cachedResponse }) => {
      if (isDuplicate && cachedResponse) {
        logger.info('Returning cached idempotent response', {
          requestId: req.context.requestId,
          token: idempotencyToken,
        });
        res.status(cachedResponse.code).json(cachedResponse.body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        idempotencyService
          .saveResponse(idempotencyToken, res.statusCode, body)
          .catch((error) => {
            logger.error('Failed to save idempotency response', {
              error: error.message,
            });
          });
        return originalJson(body);
      };

      next();
    })
    .catch((error) => {
      if (error instanceof IdempotencyConflict) {
        next(error);
      } else {
        logger.error('Idempotency middleware error', { error: error.message });
        next();
      }
    });
}
