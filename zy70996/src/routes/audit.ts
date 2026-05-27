import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { recordId, operator, action, startDate, endDate } = req.query;

    const where: any = {};
    if (recordId) where.recordId = recordId;
    if (operator) where.operator = operator;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        record: {
          include: {
            employee: true,
            batch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/record/:recordId', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { recordId: req.params.recordId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: { action: true },
    });

    const operatorCounts = await prisma.auditLog.groupBy({
      by: ['operator'],
      where,
      _count: { operator: true },
    });

    res.json({
      actionStats: actionCounts.map(a => ({ action: a.action, count: a._count.action })),
      operatorStats: operatorCounts.map(o => ({ operator: o.operator, count: o._count.operator })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
