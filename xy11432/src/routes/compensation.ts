import { Router, Request, Response } from 'express';
import {
  postCompensation,
  getCompensationByQueueItem,
  getCompensationByBatch,
  addSupervisorComment,
  getSupervisorComments,
  getLedgerSummary,
} from '../services/compensation';
import { SourceType } from '../types';

const router = Router();

router.post('/post', (req: Request, res: Response) => {
  const {
    queueItemId,
    recordId,
    sourceType,
    batchId,
    entryType,
    amount,
    quantity,
    accountCode,
    postedBy,
    reference,
    notes,
  } = req.body;
  
  if (!queueItemId || !recordId || !sourceType || !batchId || !entryType || !postedBy) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'queueItemId, recordId, sourceType, batchId, entryType, and postedBy are required',
    });
    return;
  }
  
  try {
    const ledgerId = postCompensation({
      queueItemId,
      recordId,
      sourceType: sourceType as SourceType,
      batchId,
      entryType: entryType as 'debit' | 'credit' | 'adjustment',
      amount,
      quantity,
      accountCode,
      postedBy,
      reference,
      notes,
    });
    res.json({
      success: true,
      data: { ledgerId },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/queue-item/:queueItemId', (req: Request, res: Response) => {
  const entries = getCompensationByQueueItem(req.params.queueItemId);
  res.json({
    success: true,
    data: entries,
  });
});

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const entries = getCompensationByBatch(req.params.batchId);
  res.json({
    success: true,
    data: entries,
  });
});

router.post('/comment/:queueItemId', (req: Request, res: Response) => {
  const { comment, commentedBy, isAppendOnly } = req.body;
  if (!comment || !commentedBy) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'comment and commentedBy are required',
    });
    return;
  }
  
  try {
    const commentId = addSupervisorComment(
      req.params.queueItemId,
      comment,
      commentedBy,
      isAppendOnly !== false
    );
    res.json({
      success: true,
      data: { commentId },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/comments/:queueItemId', (req: Request, res: Response) => {
  const comments = getSupervisorComments(req.params.queueItemId);
  res.json({
    success: true,
    data: comments,
  });
});

router.get('/summary', (req: Request, res: Response) => {
  const batchId = req.query.batchId as string | undefined;
  const summary = getLedgerSummary(batchId);
  res.json({
    success: true,
    data: summary,
  });
});

export default router;
