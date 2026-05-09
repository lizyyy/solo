import { Router, Request, Response } from 'express';
import { SettlementBatchStatus, SuspendReason, ALL_SUSPEND_REASONS } from '../constants';
import { asyncHandler } from '../middleware';
import { settlementBatchService, exceptionService } from '../services';
import { ValidationError } from '../utils/error';

const router = Router();

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, settlementDate, transactions, operator } = req.body;

  if (!merchantId || !settlementDate || !transactions || !operator) {
    throw new ValidationError('缺少必要参数: merchantId, settlementDate, transactions, operator');
  }

  const parsedTransactions = transactions.map((t: any) => ({
    ...t,
    transactionDate: new Date(t.transactionDate),
  }));

  const batch = await settlementBatchService.createBatch({
    merchantId,
    settlementDate: new Date(settlementDate),
    transactions: parsedTransactions,
    operator,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    data: batch,
    nextStep: '调用 POST /batches/:id/process 进行处理校验',
  });
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, status, startDate, endDate } = req.query as any;

  const filters: any = {};
  if (merchantId) filters.merchantId = merchantId;
  if (status) filters.status = status as SettlementBatchStatus;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);

  const batches = await settlementBatchService.getBatches(filters);

  res.json({
    success: true,
    data: batches,
  });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const batch = await settlementBatchService.getBatchById(req.params.id);

  res.json({
    success: true,
    data: batch,
  });
}));

router.post('/:id/process', asyncHandler(async (req: Request, res: Response) => {
  const { operator } = req.body;
  if (!operator) {
    throw new ValidationError('缺少 operator 参数');
  }

  const result = await settlementBatchService.validateAndProcessBatch(req.params.id, operator);

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/:id/suspend', asyncHandler(async (req: Request, res: Response) => {
  const { reason, note, operator } = req.body;

  if (!reason || !operator) {
    throw new ValidationError('缺少必要参数: reason, operator');
  }

  if (!ALL_SUSPEND_REASONS.includes(reason)) {
    throw new ValidationError(`无效的挂起原因: ${reason}`);
  }

  const result = await settlementBatchService.suspendBatch(
    req.params.id,
    reason as SuspendReason,
    note || '',
    operator,
    req.ip
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/:id/unsuspend/request', asyncHandler(async (req: Request, res: Response) => {
  const { requester, requestNote } = req.body;

  if (!requester) {
    throw new ValidationError('缺少 requester 参数');
  }

  const result = await settlementBatchService.requestUnsuspend(
    req.params.id,
    requester,
    requestNote,
    req.ip
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/:id/unsuspend/approve', asyncHandler(async (req: Request, res: Response) => {
  const { approvalId, approver, approvalNote } = req.body;

  if (!approvalId || !approver) {
    throw new ValidationError('缺少必要参数: approvalId, approver');
  }

  const result = await settlementBatchService.approveUnsuspend(
    approvalId,
    approver,
    approvalNote,
    req.ip
  );

  res.json({
    success: result.success,
    data: result,
  });
}));

router.post('/:id/unsuspend/reject', asyncHandler(async (req: Request, res: Response) => {
  const { approvalId, approver, approvalNote } = req.body;

  if (!approvalId || !approver || !approvalNote) {
    throw new ValidationError('缺少必要参数: approvalId, approver, approvalNote');
  }

  const result = await settlementBatchService.rejectUnsuspend(
    approvalId,
    approver,
    approvalNote,
    req.ip
  );

  res.json({
    success: true,
    data: result,
  });
}));

router.get('/:id/exceptions', asyncHandler(async (req: Request, res: Response) => {
  const { includeResolved } = req.query;

  const exceptions = await exceptionService.getExceptionsByBatch(
    req.params.id,
    includeResolved === 'true'
  );

  res.json({
    success: true,
    data: exceptions,
  });
}));

router.get('/:id/exceptions/summary', asyncHandler(async (req: Request, res: Response) => {
  const summary = await exceptionService.getBatchExceptionSummary(req.params.id);

  res.json({
    success: true,
    data: summary,
  });
}));

export { router as batchesRouter };
