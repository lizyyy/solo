import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  createOpenRecord,
  updateOpenRecord,
  closeOpenRecord,
  getOpenRecords,
  getOpenRecordById,
} from '../services/openRecordService';
import { getEntityTimeline } from '../services/auditService';

const router = Router();

router.use(authenticateToken);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await createOpenRecord({
      ...req.body,
      createdBy: req.user!.id,
    });
    res.status(201).json(record);
  })
);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await getOpenRecords({
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      batchId: req.query.batchId as string,
      isOpened: req.query.isOpened === 'true' ? true : req.query.isOpened === 'false' ? false : undefined,
    });
    res.json(result);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await getOpenRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: '开封记录不存在' });
    }
    res.json(record);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await updateOpenRecord(req.params.id, req.body, req.user!.id);
    res.json(record);
  })
);

router.post(
  '/:id/close',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const record = await closeOpenRecord(req.params.id, req.user!.id);
    res.json(record);
  })
);

router.get(
  '/:id/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const timeline = await getEntityTimeline('OPEN_RECORD', req.params.id);
    res.json(timeline);
  })
);

export default router;
