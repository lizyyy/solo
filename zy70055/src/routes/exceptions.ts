import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware';
import { exceptionService } from '../services';
import { ValidationError } from '../utils/error';

const router = Router();

router.get('/pending', asyncHandler(async (_req: Request, res: Response) => {
  const exceptions = await exceptionService.getPendingExceptions();

  res.json({
    success: true,
    data: exceptions,
  });
}));

router.post('/:exceptionNo/resolve', asyncHandler(async (req: Request, res: Response) => {
  const { resolvedBy, resolutionNote } = req.body;

  if (!resolvedBy || !resolutionNote) {
    throw new ValidationError('缺少必要参数: resolvedBy, resolutionNote');
  }

  const result = await exceptionService.resolveException(
    req.params.exceptionNo,
    resolvedBy,
    resolutionNote
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/batch-resolve', asyncHandler(async (req: Request, res: Response) => {
  const { exceptionNos, resolvedBy, resolutionNote } = req.body;

  if (!exceptionNos || !exceptionNos.length || !resolvedBy || !resolutionNote) {
    throw new ValidationError('缺少必要参数: exceptionNos, resolvedBy, resolutionNote');
  }

  const results = await exceptionService.batchResolveExceptions(
    exceptionNos,
    resolvedBy,
    resolutionNote
  );

  const successCount = results.filter(r => r.success).length;

  res.json({
    success: successCount === results.length,
    data: {
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      details: results,
    },
  });
}));

export { router as exceptionsRouter };
