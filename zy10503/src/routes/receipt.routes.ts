import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ReceiptService } from '../services/receipt.service';
import { BatchService } from '../services/batch.service';
import type { Database } from '../database/schema';

const confirmReceiptSchema = Joi.object({
  confirmedBy: Joi.string().optional(),
  confirmedAt: Joi.number().optional()
});

const markFailedSchema = Joi.object({
  failReason: Joi.string().required()
});

const manualCorrectSchema = Joi.object({
  targetStatus: Joi.string().valid('pending', 'sent', 'delivered', 'confirmed', 'failed', 'timeout', 'resent').required(),
  reason: Joi.string().required(),
  operator: Joi.string().required()
});

const processTimeoutSchema = Joi.object({
  timeoutMinutes: Joi.number().integer().min(1).default(60)
});

export const createReceiptRouter = (db: Database) => {
  const router = Router();
  const receiptService = new ReceiptService(db);
  const batchService = new BatchService(db);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = {
        batchId: req.query.batchId as string,
        tenantId: req.query.tenantId as string,
        status: req.query.status as any,
        channel: req.query.channel as any,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 20,
        startAt: req.query.startAt ? parseInt(req.query.startAt as string) : undefined,
        endAt: req.query.endAt ? parseInt(req.query.endAt as string) : undefined
      };

      const result = await receiptService.queryReceipts(query);

      res.json({
        success: true,
        data: {
          receipts: result.receipts,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total: result.total
          }
        }
      });
    } catch (err) {
      console.error('查询回执失败:', err);
      res.status(500).json({ error: '查询回执失败' });
    }
  });

  router.get('/:receiptId', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const receipt = await receiptService.getReceiptById(receiptId);

      if (!receipt) {
        return res.status(404).json({ error: '回执不存在' });
      }

      res.json({
        success: true,
        data: receipt
      });
    } catch (err) {
      console.error('获取回执详情失败:', err);
      res.status(500).json({ error: '获取回执详情失败' });
    }
  });

  router.get('/:receiptId/trace', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const result = await receiptService.getReceiptTrace(receiptId);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('获取回执追踪失败:', err);
      res.status(500).json({ error: '获取回执追踪失败' });
    }
  });

  router.post('/:receiptId/confirm', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const { error, value } = confirmReceiptSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const receipt = await receiptService.confirmReceipt(receiptId, value.confirmedBy, value.confirmedAt);

      await batchService.updateBatchStats(receipt.batchId);

      res.json({
        success: true,
        data: receipt
      });
    } catch (err) {
      console.error('确认回执失败:', err);
      res.status(500).json({ error: (err as Error).message || '确认回执失败' });
    }
  });

  router.post('/:receiptId/delivered', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const receipt = await receiptService.markDelivered(receiptId);

      await batchService.updateBatchStats(receipt.batchId);

      res.json({
        success: true,
        data: receipt
      });
    } catch (err) {
      console.error('标记送达失败:', err);
      res.status(500).json({ error: '标记送达失败' });
    }
  });

  router.post('/:receiptId/failed', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const { error, value } = markFailedSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const receipt = await receiptService.markFailed(receiptId, value.failReason);

      await batchService.updateBatchStats(receipt.batchId);

      res.json({
        success: true,
        data: receipt
      });
    } catch (err) {
      console.error('标记失败失败:', err);
      res.status(500).json({ error: '标记失败失败' });
    }
  });

  router.post('/batch/:batchId/process-timeout', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const { error, value } = processTimeoutSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const count = await receiptService.processTimeout(batchId, value.timeoutMinutes);

      await batchService.updateBatchStats(batchId);

      res.json({
        success: true,
        data: {
          processedCount: count
        }
      });
    } catch (err) {
      console.error('处理超时失败:', err);
      res.status(500).json({ error: '处理超时失败' });
    }
  });

  router.post('/:receiptId/manual-correct', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;
      const { error, value } = manualCorrectSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const receipt = await receiptService.manualCorrect({
        receiptId,
        ...value
      });

      await batchService.updateBatchStats(receipt.batchId);

      res.json({
        success: true,
        data: receipt
      });
    } catch (err) {
      console.error('人工修正失败:', err);
      res.status(500).json({ error: '人工修正失败' });
    }
  });

  return router;
};
