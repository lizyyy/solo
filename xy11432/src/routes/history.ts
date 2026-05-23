import { Router, Request, Response } from 'express';
import {
  getHistoryByQueueItem,
  getHistoryByOperator,
  getHistoryTimeline,
  getChangeSummary,
} from '../services/history';

const router = Router();

router.get('/queue-item/:queueItemId', (req: Request, res: Response) => {
  const history = getHistoryByQueueItem(req.params.queueItemId);
  res.json({
    success: true,
    data: history,
  });
});

router.get('/operator/:operator', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const history = getHistoryByOperator(req.params.operator, limit);
  res.json({
    success: true,
    data: history,
  });
});

router.get('/timeline', (req: Request, res: Response) => {
  const startDate = req.query.startDate ? parseInt(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? parseInt(req.query.endDate as string) : undefined;
  const history = getHistoryTimeline(startDate, endDate);
  res.json({
    success: true,
    data: history,
  });
});

router.get('/summary/:queueItemId', (req: Request, res: Response) => {
  const summary = getChangeSummary(req.params.queueItemId);
  res.json({
    success: true,
    data: summary,
  });
});

export default router;
