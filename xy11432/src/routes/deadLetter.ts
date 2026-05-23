import { Router, Request, Response } from 'express';
import {
  getDeadLetter,
  getDeadLetterByQueueItem,
  getUnresolvedDeadLetters,
  resolveDeadLetter,
  getDeadLetterStatistics,
} from '../services/deadLetter';

const router = Router();

router.get('/item/:id', (req: Request, res: Response) => {
  const item = getDeadLetter(req.params.id);
  if (!item) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Dead letter not found',
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.get('/queue-item/:queueItemId', (req: Request, res: Response) => {
  const item = getDeadLetterByQueueItem(req.params.queueItemId);
  if (!item) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Dead letter not found for this queue item',
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.get('/unresolved', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const items = getUnresolvedDeadLetters(limit);
  res.json({
    success: true,
    data: items,
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const stats = getDeadLetterStatistics();
  res.json({
    success: true,
    data: stats,
  });
});

router.post('/resolve/:id', (req: Request, res: Response) => {
  const { operator, resolution, action } = req.body;
  if (!operator || !resolution || !action) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator, resolution, and action are required',
    });
    return;
  }
  
  if (!['retry', 'dismiss'].includes(action)) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'action must be either "retry" or "dismiss"',
    });
    return;
  }
  
  try {
    resolveDeadLetter(req.params.id, operator, resolution, action as 'retry' | 'dismiss');
    res.json({
      success: true,
      message: 'Dead letter resolved',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
