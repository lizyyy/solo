import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { BatchService } from '../services/batch.service';
import type { Database } from '../database/schema';

const createBatchSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
  channel: Joi.string().valid('email', 'sms', 'in_app', 'webhook', 'wechat').required(),
  tenants: Joi.array().items(
    Joi.object({
      tenantId: Joi.string().required(),
      tenantName: Joi.string().required(),
      target: Joi.string().required(),
      contact: Joi.string().optional()
    })
  ).min(1).required(),
  createdBy: Joi.string().required(),
  remark: Joi.string().optional(),
  maxRetry: Joi.number().integer().min(0).max(10).optional(),
  confirmTimeout: Joi.number().integer().min(1).optional()
});

export const createBatchRouter = (db: Database) => {
  const router = Router();
  const batchService = new BatchService(db);

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { error, value } = createBatchSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const batch = await batchService.createBatch(value);

      res.status(201).json({
        success: true,
        data: batch
      });
    } catch (err) {
      console.error('创建批次失败:', err);
      res.status(500).json({ error: '创建批次失败' });
    }
  });

  router.post('/:batchId/start', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const batch = await batchService.startBatch(batchId);
      await batchService.updateBatchStats(batchId);

      res.json({
        success: true,
        data: batch
      });
    } catch (err) {
      console.error('启动批次失败:', err);
      res.status(500).json({ error: '启动批次失败' });
    }
  });

  router.get('/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const batch = await batchService.getBatchById(batchId);

      if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (err) {
      console.error('获取批次详情失败:', err);
      res.status(500).json({ error: '获取批次详情失败' });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await batchService.listBatches(page, pageSize);

      res.json({
        success: true,
        data: {
          batches: result.batches,
          pagination: {
            page,
            pageSize,
            total: result.total
          }
        }
      });
    } catch (err) {
      console.error('获取批次列表失败:', err);
      res.status(500).json({ error: '获取批次列表失败' });
    }
  });

  return router;
};
