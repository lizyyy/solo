import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware/errorHandler';
import { submitRecords, getRecordsByBatch, getRecord, resubmitCancelledItem } from '../services/submission';
import { SourceType, RetryStrategy } from '../types';

const router = Router();

const submitSchema = Joi.object({
  sourceType: Joi.string().valid(...Object.values(SourceType)).required(),
  batchId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      sourceId: Joi.string().required(),
      data: Joi.object().required(),
    })
  ).required(),
  submittedBy: Joi.string().required(),
  retryStrategy: Joi.string().valid(...Object.values(RetryStrategy)).optional(),
  comment: Joi.string().optional(),
});

router.post(
  '/submit',
  validateRequest(submitSchema),
  (req: Request, res: Response) => {
    const result = submitRecords(req.body);
    res.json({
      success: true,
      data: result,
    });
  }
);

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const records = getRecordsByBatch(req.params.batchId);
  res.json({
    success: true,
    data: records,
  });
});

router.get('/record/:recordId', (req: Request, res: Response) => {
  const record = getRecord(req.params.recordId);
  if (!record) {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Record not found',
    });
    return;
  }
  res.json({
    success: true,
    data: record,
  });
});

router.post('/resubmit/:queueItemId', (req: Request, res: Response) => {
  const { operator, newData } = req.body;
  if (!operator) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'operator is required',
    });
    return;
  }
  
  try {
    const result = resubmitCancelledItem(req.params.queueItemId, operator, newData);
    res.json({
      success: true,
      data: { queueItemId: result },
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
