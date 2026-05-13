import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import { createBatch, getBatches, getBatchById } from '../services/reagentService';
import { getEntityTimeline } from '../services/auditService';
import { ReagentStatus } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const batch = await createBatch({
      ...req.body,
      createdBy: req.user!.id,
    });
    res.status(201).json(batch);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getBatches({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      reagentId: req.query.reagentId as string,
      status: req.query.status as ReagentStatus,
      search: req.query.search as string,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const batch = await getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批号不存在' });
    }
    res.json(batch);
  })
);

router.get(
  '/:id/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const timeline = await getEntityTimeline('BATCH', req.params.id);
    res.json(timeline);
  })
);

export default router;
