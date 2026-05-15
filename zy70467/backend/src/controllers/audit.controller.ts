import { Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { asyncHandler } from '../middleware/errorHandler';

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, batchItemId, page, pageSize } = req.query;
  const result = await auditService.getAuditLogs({
    batchId: batchId as string,
    batchItemId: batchItemId as string,
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
  });
  res.json({ success: true, data: result });
});

export const submitReview = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, itemId, reviewComment, reviewedBy, decision } = req.body;
  const result = await auditService.submitReview({
    batchId,
    itemId,
    reviewComment,
    reviewedBy: reviewedBy || 'admin',
    decision,
  });
  res.json({ success: true, data: result });
});
