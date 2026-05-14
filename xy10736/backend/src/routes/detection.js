const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const stateMachine = require('../services/stateMachine');

router.get('/', async (req, res) => {
  const { page = 1, pageSize = 20, status, sessionId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (sessionId) where.sessionId = sessionId;

  const [detections, total] = await Promise.all([
    prisma.missingDetection.findMany({
      where,
      include: { trackingPoint: true, session: true, reviewLogs: true },
      skip: (page - 1) * pageSize,
      take: parseInt(pageSize),
      orderBy: { detectedAt: 'desc' }
    }),
    prisma.missingDetection.count({ where })
  ]);

  res.json({ data: detections, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const detection = await stateMachine.transitionDetectionStatus(
      req.params.id, 'confirmed', operator, reason
    );
    res.json(detection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { operator, reason, resolution, correctionPath } = req.body;

    await prisma.missingDetection.update({
      where: { id: req.params.id },
      data: {
        reason,
        resolution,
        correctionPath
      }
    });

    const detection = await stateMachine.transitionDetectionStatus(
      req.params.id, 'resolved', operator, reason
    );
    res.json(detection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const detection = await stateMachine.transitionDetectionStatus(
      req.params.id, 'dismissed', operator, reason
    );
    res.json(detection);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/stats/trend', async (req, res) => {
  const { days = 7 } = req.query;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const detections = await prisma.missingDetection.findMany({
    where: {
      detectedAt: { gte: startDate, lte: endDate }
    },
    orderBy: { detectedAt: 'asc' }
  });

  const dailyStats = {};
  detections.forEach(d => {
    const date = d.detectedAt.toISOString().split('T')[0];
    dailyStats[date] = (dailyStats[date] || 0) + 1;
  });

  const result = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    result.push({ date, count: dailyStats[date] || 0 });
  }

  res.json(result);
});

router.get('/stats/bypage', async (req, res) => {
  const points = await prisma.trackingPoint.findMany({
    include: { missingDetections: true }
  });

  const pageStats = {};
  points.forEach(p => {
    if (!pageStats[p.page]) {
      pageStats[p.page] = { page: p.page, total: 0, missing: 0 };
    }
    pageStats[p.page].total++;
    pageStats[p.page].missing += p.missingDetections.length;
  });

  res.json(Object.values(pageStats));
});

module.exports = router;
