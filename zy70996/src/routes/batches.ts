import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, description, benefitType, startTime, endTime, totalQuantity, createdBy } = req.body;

    if (!id || !name || !benefitType || !createdBy) {
      return res.status(400).json({ error: '缺少必要参数: id, name, benefitType, createdBy' });
    }

    const batch = await prisma.benefitBatch.create({
      data: {
        id,
        name,
        description,
        benefitType,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        totalQuantity: totalQuantity || 0,
        createdBy,
      },
    });

    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, benefitType } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (benefitType) where.benefitType = benefitType;

    const batches = await prisma.benefitBatch.findMany({
      where,
      include: {
        _count: {
          select: {
            collectionRecords: true,
            coupons: true,
          },
        },
      },
    });
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await prisma.benefitBatch.findUnique({
      where: { id: req.params.id },
      include: {
        collectionRecords: {
          include: {
            employee: true,
            auditLogs: true,
          },
        },
        coupons: true,
      },
    });
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const batch = await prisma.benefitBatch.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
