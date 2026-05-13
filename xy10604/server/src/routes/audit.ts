import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import { getAuditLogs, getEntityTimeline } from '../services/auditService';

const router = Router();

router.use(authenticateToken);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getAuditLogs({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      userId: req.query.userId as string,
      action: req.query.action as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(result);
  })
);

router.get(
  '/timeline/:entityType/:entityId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const timeline = await getEntityTimeline(req.params.entityType, req.params.entityId);
    res.json(timeline);
  })
);

export default router;
