import { Router, Request, Response } from 'express';
import {
  getQueueItem,
  getQueueItemsByBatch,
  getPendingItems,
  getRetryableItems,
  updateQueueStatus,
  markForRetry,
  markAsManualReview,
  freezeQueueItem,
  unfreezeQueueItem,
  cancelQueueItem,
  closeQueueItem,
  getQueueStatistics,
} from '../services/queue';
import { QueueStatus } from '../types';

const router = Router();

router.get('/item/:id', (req: Request, res: Response) => {
  const item = getQueueItem(req.params.id);
  if (!item) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Queue item not found',
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const items = getQueueItemsByBatch(req.params.batchId);
  res.json({
    success: true,
    data: items,
  });
});

router.get('/pending', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const items = getPendingItems(limit);
  res.json({
    success: true,
    data: items,
  });
});

router.get('/retryable', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const items = getRetryableItems(limit);
  res.json({
    success: true,
    data: items,
  });
});

router.get('/statistics', (req: Request, res: Response) => {
  const stats = getQueueStatistics();
  res.json({
    success: true,
    data: stats,
  });
});

router.post('/status/:id', (req: Request, res: Response) => {
  const { status, operator, comment } = req.body;
  if (!status || !operator) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'status and operator are required',
    });
    return;
  }
  
  try {
    updateQueueStatus(req.params.id, status as QueueStatus, operator, { comment });
    res.json({
      success: true,
      message: 'Status updated',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/retry/:id', (req: Request, res: Response) => {
  const { operator, error } = req.body;
  if (!operator) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator is required',
    });
    return;
  }
  
  try {
    markForRetry(req.params.id, operator, error ? new Error(error) : undefined);
    res.json({
      success: true,
      message: 'Marked for retry',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/manual-review/:id', (req: Request, res: Response) => {
  const { operator, comment } = req.body;
  if (!operator || !comment) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator and comment are required',
    });
    return;
  }
  
  try {
    markAsManualReview(req.params.id, operator, comment);
    res.json({
      success: true,
      message: 'Marked for manual review',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/freeze/:id', (req: Request, res: Response) => {
  const { operator, reason } = req.body;
  if (!operator || !reason) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator and reason are required',
    });
    return;
  }
  
  try {
    freezeQueueItem(req.params.id, operator, reason);
    res.json({
      success: true,
      message: 'Item frozen',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/unfreeze/:id', (req: Request, res: Response) => {
  const { operator, reason } = req.body;
  if (!operator || !reason) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator and reason are required',
    });
    return;
  }
  
  try {
    unfreezeQueueItem(req.params.id, operator, reason);
    res.json({
      success: true,
      message: 'Item unfrozen',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/cancel/:id', (req: Request, res: Response) => {
  const { operator, reason } = req.body;
  if (!operator || !reason) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator and reason are required',
    });
    return;
  }
  
  try {
    cancelQueueItem(req.params.id, operator, reason);
    res.json({
      success: true,
      message: 'Item cancelled',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/close/:id', (req: Request, res: Response) => {
  const { operator, comment } = req.body;
  if (!operator) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator is required',
    });
    return;
  }
  
  try {
    closeQueueItem(req.params.id, operator, comment);
    res.json({
      success: true,
      message: 'Item closed',
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
