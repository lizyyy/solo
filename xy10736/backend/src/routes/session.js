const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stateMachine = require('../services/stateMachine');
const { v4: uuidv4 } = require('uuid');

router.post('/start', async (req, res) => {
  const { version, operator } = req.body;
  const sessionId = uuidv4();

  const session = await prisma.debugSession.create({
    data: {
      sessionId,
      version,
      operator,
      status: 'active'
    }
  });

  res.json(session);
});

router.post('/:id/complete', async (req, res) => {
  try {
    const session = await stateMachine.transitionSessionStatus(req.params.id, 'completed');
    await stateMachine.recalculateSessionDetections(session.sessionId);
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  const { page = 1, pageSize = 20, status, version } = req.query;
  const where = {};
  if (status) where.status = status;
  if (version) where.version = version;

  const [sessions, total] = await Promise.all([
    prisma.debugSession.findMany({
      where,
      include: {
        _count: {
          select: { pageEvents: true, missingDetections: true }
        }
      },
      skip: (page - 1) * pageSize,
      take: parseInt(pageSize),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.debugSession.count({ where })
  ]);

  res.json({ data: sessions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.get('/:sessionId/detail', async (req, res) => {
  const session = await prisma.debugSession.findUnique({
    where: { sessionId: req.params.sessionId },
    include: {
      pageEvents: { include: { trackingPoint: true } },
      missingDetections: { include: { trackingPoint: true, reviewLogs: true } }
    }
  });

  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  res.json(session);
});

module.exports = router;
