import { Router, Request, Response } from 'express';
import { refundReviewService } from '../services/refundReviewService';
import { exportService } from '../services/exportService';
import { ReviewRequest, ManualRemarkRequest } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const result = refundReviewService.createRefundReview(req.body);
  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const result = refundReviewService.getRefundReview(req.params.id);
  res.json(result);
});

router.get('/:id/detail', (req: Request, res: Response) => {
  const result = refundReviewService.getReviewDetailWithLabels(req.params.id);
  res.json(result);
});

router.get('/', (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const filters = {
    status: req.query.status as string | undefined,
    userId: req.query.userId as string | undefined,
    orderNo: req.query.orderNo as string | undefined
  };
  const result = refundReviewService.listRefundReviews(page, pageSize, filters);
  res.json(result);
});

router.post('/:id/review', (req: Request, res: Response) => {
  const result = refundReviewService.review(req.params.id, req.body as ReviewRequest);
  res.json(result);
});

router.post('/:id/remark', (req: Request, res: Response) => {
  const result = refundReviewService.addManualRemark(req.params.id, req.body as ManualRemarkRequest);
  res.json(result);
});

router.get('/:id/audit', (req: Request, res: Response) => {
  const result = refundReviewService.getAuditLogs(req.params.id);
  res.json(result);
});

router.get('/export/fields', async (req: Request, res: Response) => {
  const result = exportService.getExportFieldConfig();
  res.json(result);
});

router.post('/export', async (req: Request, res: Response) => {
  const result = await exportService.exportToCsv(req.body);
  res.json(result);
});

export default router;
