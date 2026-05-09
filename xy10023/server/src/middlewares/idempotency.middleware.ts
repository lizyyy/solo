import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { IdempotencyRecord, IdempotencyStatus } from '../models/IdempotencyRecord';
import logger from '../utils/logger';

const IDEMPOTENCY_HEADER = 'x-request-id';
const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';
const DEFAULT_EXPIRY_HOURS = 24;

interface RequestWithIdempotency extends Request {
  requestId?: string;
  idempotencyRecord?: IdempotencyRecord;
}

export const idempotencyMiddleware = async (
  req: RequestWithIdempotency,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const requestId = (req.headers[IDEMPOTENCY_HEADER] as string) || uuidv4();
  const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER] as string | undefined;

  req.requestId = requestId;
  res.setHeader(IDEMPOTENCY_HEADER, requestId);

  const existingRecord = await IdempotencyRecord.findOne({
    where: {
      requestId,
    },
  });

  if (existingRecord) {
    return handleExistingRecord(existingRecord, res, next);
  }

  if (idempotencyKey) {
    const keyedRecord = await IdempotencyRecord.findOne({
      where: {
        idempotencyKey,
        endpoint: req.path,
        method: req.method,
      },
    });

    if (keyedRecord && keyedRecord.expiresAt > new Date()) {
      return handleExistingRecord(keyedRecord, res, next);
    }
  }

  await createProcessingRecord(requestId, idempotencyKey, req);

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = async (body: unknown) => {
    await finalizeRecord(requestId, IdempotencyStatus.COMPLETED, res.statusCode, body);
    return originalJson(body);
  };

  res.send = async (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      await finalizeRecord(requestId, IdempotencyStatus.COMPLETED, res.statusCode, body);
    } else {
      await finalizeRecord(
        requestId,
        IdempotencyStatus.FAILED,
        res.statusCode,
        undefined,
        typeof body === 'string' ? body : JSON.stringify(body)
      );
    }
    return originalSend(body);
  };

  next();
};

async function handleExistingRecord(
  record: IdempotencyRecord,
  res: Response,
  next: NextFunction
): Promise<void> {
  switch (record.status) {
    case IdempotencyStatus.COMPLETED:
      logger.info(`Idempotency hit: Returning cached response for request ${record.requestId}`);
      if (record.statusCode) {
        res.status(record.statusCode);
      }
      res.setHeader('X-Idempotency-Cached', 'true');
      if (record.responseData) {
        res.json(record.responseData);
      } else {
        res.send();
      }
      return;

    case IdempotencyStatus.PROCESSING:
      res.status(409).json({
        error: 'REQUEST_IN_PROGRESS',
        message: 'This request is still being processed. Please try again later.',
        requestId: record.requestId,
      });
      return;

    case IdempotencyStatus.FAILED:
      logger.warn(`Idempotency: Previous request failed, allowing retry: ${record.requestId}`);
      return next();

    default:
      return next();
  }
}

async function createProcessingRecord(
  requestId: string,
  idempotencyKey: string | undefined,
  req: Request
): Promise<IdempotencyRecord> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRY_HOURS);

  return IdempotencyRecord.create({
    id: uuidv4(),
    requestId,
    idempotencyKey,
    endpoint: req.path,
    method: req.method,
    requestData: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
    status: IdempotencyStatus.PROCESSING,
    expiresAt,
  });
}

async function finalizeRecord(
  requestId: string,
  status: IdempotencyStatus,
  statusCode: number,
  responseData?: unknown,
  errorMessage?: string
): Promise<void> {
  try {
    await IdempotencyRecord.update(
      {
        status,
        statusCode,
        responseData: responseData as Record<string, unknown>,
        errorMessage,
      },
      {
        where: { requestId },
      }
    );
  } catch (error) {
    logger.error('Failed to update idempotency record:', error);
  }
}

export const cleanupExpiredRecords = async (): Promise<number> => {
  const deletedCount = await IdempotencyRecord.destroy({
    where: {
      expiresAt: { [Symbol.for('lt')]: new Date() } as any,
    },
  });

  if (deletedCount > 0) {
    logger.info(`Cleaned up ${deletedCount} expired idempotency records`);
  }

  return deletedCount;
};

export default idempotencyMiddleware;
