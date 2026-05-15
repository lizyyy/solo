import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import crypto from 'crypto';

const LOCK_TIMEOUT = 30000;

export function generateRequestKey(req: Request): string {
  const bodyHash = crypto
    .createHash('md5')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');
  return `${req.method}:${req.path}:${bodyHash}:${req.ip}`;
}

export async function requestLockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === 'GET') {
    return next();
  }

  const requestKey = generateRequestKey(req);
  const now = new Date();

  try {
    await prisma.requestLock.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    const existingLock = await prisma.requestLock.findUnique({
      where: { requestKey },
    });

    if (existingLock) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_REQUEST',
        message: '请求正在处理中，请稍后再试',
      });
    }

    await prisma.requestLock.create({
      data: {
        requestKey,
        expiresAt: new Date(now.getTime() + LOCK_TIMEOUT),
        lockedBy: req.ip,
      },
    });

    (req as any).requestLockKey = requestKey;

    const originalSend = res.send.bind(res);
    res.send = function (body: any) {
      prisma.requestLock
        .delete({ where: { requestKey } })
        .catch(() => {})
        .finally(() => {});
      return originalSend(body);
    };

    next();
  } catch (error) {
    next(error);
  }
}
