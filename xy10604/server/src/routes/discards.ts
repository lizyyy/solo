import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createDiscard,
  getDiscardRecords,
  getDiscardById,
  getDiscardStatistics,
} from '../services/discardService';
import { DiscardReason } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const discard = await createDiscard({
      ...req.body,
      createdBy: req.user!.id,
    });
    res.status(201).json(discard);
  })
);

router.get(
  '/statistics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const stats = await getDiscardStatistics({
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      reagentId: req.query.reagentId as string,
    });
    res.json(stats);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getDiscardRecords({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      batchId: req.query.batchId as string,
      reason: req.query.reason as DiscardReason,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const discard = await getDiscardById(req.params.id);
    if (!discard) {
      return res.status(404).json({ error: '废弃记录不存在' });
    }
    res.json(discard);
  })
);

export default router;
