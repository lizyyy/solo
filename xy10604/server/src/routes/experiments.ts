import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createExperiment,
  updateExperimentStatus,
  getExperiments,
  getExperimentById,
  validateExperiment,
} from '../services/experimentService';
import { getEntityTimeline } from '../services/auditService';
import { ExperimentStatus } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.post(
  '/validate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const validation = await validateExperiment(req.body.batchId, req.body.scheduledDate);
    res.json(validation);
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await createExperiment(
      {
        ...req.body,
        createdBy: req.user!.id,
      },
      req.body.applyValidation !== false
    );
    res.status(201).json(result);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getExperiments({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      batchId: req.query.batchId as string,
      status: req.query.status as ExperimentStatus,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const experiment = await getExperimentById(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }
    res.json(experiment);
  })
);

router.put(
  '/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const experiment = await updateExperimentStatus(
      req.params.id,
      req.body.status,
      req.user!.id
    );
    res.json(experiment);
  })
);

router.get(
  '/:id/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const timeline = await getEntityTimeline('EXPERIMENT', req.params.id);
    res.json(timeline);
  })
);

export default router;
