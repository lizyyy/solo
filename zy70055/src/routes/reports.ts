import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware';
import { settlementReportService } from '../services';
import { ValidationError } from '../utils/error';

const router = Router();

router.get('/dashboard', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await settlementReportService.getDashboardStats();

  res.json({
    success: true,
    data: stats,
  });
}));

router.post('/batches/:batchId/approve', asyncHandler(async (req: Request, res: Response) => {
  const { approver } = req.body;

  if (!approver) {
    throw new ValidationError('缺少 approver 参数');
  }

  const result = await settlementReportService.approveForPayment(
    req.params.batchId,
    approver,
    req.ip
  );

  res.json({
    success: result.success,
    data: result,
  });
}));

router.post('/batches/:batchId/generate', asyncHandler(async (req: Request, res: Response) => {
  const { generatedBy } = req.body;

  if (!generatedBy) {
    throw new ValidationError('缺少 generatedBy 参数');
  }

  const result = await settlementReportService.generatePaymentReport(
    req.params.batchId,
    generatedBy,
    req.ip
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/batches/:batchId/mark-paid', asyncHandler(async (req: Request, res: Response) => {
  const { operator } = req.body;

  if (!operator) {
    throw new ValidationError('缺少 operator 参数');
  }

  const result = await settlementReportService.markAsPaid(
    req.params.batchId,
    operator,
    req.ip
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.get('/batches/:batchId', asyncHandler(async (req: Request, res: Response) => {
  const reports = await settlementReportService.getReportsByBatch(req.params.batchId);

  res.json({
    success: true,
    data: reports,
  });
}));

export { router as reportsRouter };
