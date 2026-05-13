import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

router.use(authenticateToken);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 50, batchId, isResolved } = req.query;

    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (isResolved === 'true') where.isResolved = true;
    if (isResolved === 'false') where.isResolved = false;

    const [records, total] = await Promise.all([
      prisma.blockRecord.findMany({
        where,
        include: {
          batch: {
            include: {
              reagent: true,
            },
          },
          experiment: true,
          reviewRecords: {
            include: {
              reviewer: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { blockedAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.blockRecord.count({ where }),
    ]);

    res.json({
      records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await prisma.blockRecord.findUnique({
      where: { id: req.params.id },
      include: {
        batch: {
          include: {
            reagent: true,
          },
        },
        experiment: true,
        reviewRecords: {
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ error: '拦截记录不存在' });
    }

    res.json(record);
  })
);

router.post(
  '/:id/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { resolutionNotes } = req.body;

    const oldRecord = await prisma.blockRecord.findUnique({
      where: { id: req.params.id },
    });

    if (!oldRecord) {
      return res.status(404).json({ error: '拦截记录不存在' });
    }

    if (oldRecord.isResolved) {
      return res.status(400).json({ error: '该拦截记录已被处理' });
    }

    const record = await prisma.blockRecord.update({
      where: { id: req.params.id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user!.id,
        resolutionNotes,
      },
    });

    res.json(record);
  })
);

export default router;
