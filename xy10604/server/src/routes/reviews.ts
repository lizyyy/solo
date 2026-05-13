import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireReviewer } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createReview,
  getReviewRecords,
  getReviewById,
} from '../services/reviewService';
import { ReviewDecision } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  requireReviewer,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const review = await createReview({
      ...req.body,
      reviewerId: req.user!.id,
    });
    res.status(201).json(review);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getReviewRecords({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      batchId: req.query.batchId as string,
      experimentId: req.query.experimentId as string,
      reviewerId: req.query.reviewerId as string,
      decision: req.query.decision as ReviewDecision,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const review = await getReviewById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: '复核记录不存在' });
    }
    res.json(review);
  })
);

export default router;
