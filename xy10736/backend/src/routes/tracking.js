const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const idempotencyMiddleware = require('../middleware/idempotency');

router.get('/points', async (req, res) => {
  const { page = 1, pageSize = 20, status, version } = req.query;
  const where = {};
  if (status) where.status = status;
  if (version) where.version = version;

  const [points, total] = await Promise.all([
    prisma.trackingPoint.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: parseInt(pageSize),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.trackingPoint.count({ where })
  ]);

  res.json({ data: points, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/points', async (req, res) => {
  const point = await prisma.trackingPoint.create({
    data: req.body
  });
  res.json(point);
});

router.put('/points/:id', async (req, res) => {
  const point = await prisma.trackingPoint.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(point);
});

router.post('/event', idempotencyMiddleware, async (req, res) => {
  const { trackingCode, sessionId, pageUrl, userId, properties, userAgent, ip } = req.body;

  const event = await prisma.pageEvent.create({
    data: {
      trackingCode,
      sessionId,
      pageUrl,
      userId,
      properties,
      userAgent,
      ip,
      idempotencyKey: req.idempotencyKey,
      status: 'received'
    }
  });

  res.json({ id: event.id, status: event.status, message: '事件接收成功' });
});

router.get('/events', async (req, res) => {
  const { page = 1, pageSize = 20, sessionId, trackingCode, status } = req.query;
  const where = {};
  if (sessionId) where.sessionId = sessionId;
  if (trackingCode) where.trackingCode = trackingCode;
  if (status) where.status = status;

  const [events, total] = await Promise.all([
    prisma.pageEvent.findMany({
      where,
      include: { trackingPoint: true },
      skip: (page - 1) * pageSize,
      take: parseInt(pageSize),
      orderBy: { timestamp: 'desc' }
    }),
    prisma.pageEvent.count({ where })
  ]);

  res.json({ data: events, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

module.exports = router;
