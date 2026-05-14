const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAX_RETRY_COUNT = 3;

const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
  
  if (!idempotencyKey) {
    return res.status(400).json({ error: '缺少幂等键' });
  }

  const existingEvent = await prisma.pageEvent.findUnique({
    where: { idempotencyKey }
  });

  if (existingEvent) {
    if (existingEvent.retryCount >= MAX_RETRY_COUNT) {
      return res.status(429).json({
        error: '重试次数已达上限',
        retryCount: existingEvent.retryCount,
        maxRetries: MAX_RETRY_COUNT
      });
    }

    await prisma.pageEvent.update({
      where: { idempotencyKey },
      data: { retryCount: { increment: 1 } }
    });

    return res.json({
      id: existingEvent.id,
      status: existingEvent.status,
      retryCount: existingEvent.retryCount + 1,
      message: '幂等响应'
    });
  }

  req.idempotencyKey = idempotencyKey;
  next();
};

module.exports = idempotencyMiddleware;
