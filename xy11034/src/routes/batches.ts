import { Router, Request, Response } from 'express';
import { batchService } from '../services/batchService';
import { BatchStatus } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const batches = batchService.getAllBatches();
  res.json({
    success: true,
    data: batches,
    timestamp: new Date()
  });
});

router.get('/reports', (req: Request, res: Response) => {
  const reports = batchService.getBatchReports();
  res.json({
    success: true,
    data: reports,
    timestamp: new Date()
  });
});

router.get('/status/:status', (req: Request, res: Response) => {
  const status = req.params.status as BatchStatus;
  const batches = batchService.getBatchesByStatus(status);
  res.json({
    success: true,
    data: batches,
    timestamp: new Date()
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const batch = batchService.getBatchDetail(req.params.id);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: '批次不存在',
      timestamp: new Date()
    });
  }
  res.json({
    success: true,
    data: batch,
    timestamp: new Date()
  });
});

router.post('/', (req: Request, res: Response) => {
  const result = batchService.createBatch(req.body, req.body.createdBy || 'system');

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      timestamp: new Date()
    });
  }

  res.status(201).json({
    success: true,
    data: result.batch,
    message: result.explanation,
    timestamp: new Date()
  });
});

router.patch('/:id', (req: Request, res: Response) => {
  const result = batchService.updateBatchStatus(
    req.params.id,
    req.body,
    req.body.updatedBy || 'system'
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    data: result.batch,
    message: result.explanation,
    timestamp: new Date()
  });
});

router.post('/:id/resolve', (req: Request, res: Response) => {
  const result = batchService.resolveAttentionBatch(
    req.params.id,
    req.body.resolution,
    req.body.resolvedBy || 'system',
    req.body.approve
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    data: result.batch,
    message: req.body.approve ? '批次已批准' : '批次已驳回',
    timestamp: new Date()
  });
});

export default router;
