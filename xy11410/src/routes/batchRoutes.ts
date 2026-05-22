import { Router, Request, Response } from 'express';
import { batchService } from '../services/BatchService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.createBatch(req.body);
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.getBatch(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await batchService.getBatchList({
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/receipts', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.addReceiptsToBatch(req.params.id, req.body.receiptIds);
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id/receipts', async (req: Request, res: Response) => {
  try {
    const batch = await batchService.removeReceiptsFromBatch(req.params.id, req.body.receiptIds);
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await batchService.deleteBatch(req.params.id);
    res.json({ success, data: { deleted: success } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
