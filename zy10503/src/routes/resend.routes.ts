import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ResendService } from '../services/resend.service';
import { BatchService } from '../services/batch.service';
import type { Database } from '../database/schema';

const createResendSchema = Joi.object({
  receiptIds: Joi.array().items(Joi.string()).min(1).required(),
  channel: Joi.string().valid('email', 'sms', 'in_app', 'webhook', 'wechat').optional(),
  target: Joi.string().optional(),
  operator: Joi.string().required(),
  remark: Joi.string().optional()
});

export const createResendRouter = (db: Database) => {
  const router = Router();
  const resendService = new ResendService(db);
  const batchService = new BatchService(db);

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { error, value } = createResendSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await resendService.createResendRecords(value);

      for (const record of result.records) {
        await batchService.updateBatchStats(record.batchId);
      }

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('创建补发失败:', err);
      res.status(500).json({ error: '创建补发失败' });
    }
  });

  router.get('/pending', async (_req: Request, res: Response) => {
    try {
      const records = await resendService.getPendingResends();

      res.json({
        success: true,
        data: records
      });
    } catch (err) {
      console.error('获取待补发列表失败:', err);
      res.status(500).json({ error: '获取待补发列表失败' });
    }
  });

  router.get('/batch/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const records = await resendService.getResendRecordsByBatch(batchId);

      res.json({
        success: true,
        data: records
      });
    } catch (err) {
      console.error('获取批次补发记录失败:', err);
      res.status(500).json({ error: '获取批次补发记录失败' });
    }
  });

  router.post('/:resendId/start', async (req: Request, res: Response) => {
    try {
      const { resendId } = req.params;
      await resendService.startResend(resendId);

      res.json({
        success: true,
        message: '开始补发'
      });
    } catch (err) {
      console.error('启动补发失败:', err);
      res.status(500).json({ error: '启动补发失败' });
    }
  });

  router.post('/:resendId/success', async (req: Request, res: Response) => {
    try {
      const { resendId } = req.params;
      await resendService.markResendSuccess(resendId);

      res.json({
        success: true,
        message: '标记补发成功'
      });
    } catch (err) {
      console.error('标记补发成功失败:', err);
      res.status(500).json({ error: '标记补发成功失败' });
    }
  });

  router.post('/:resendId/failed', async (req: Request, res: Response) => {
    try {
      const { resendId } = req.params;
      const { failReason } = req.body;

      if (!failReason) {
        return res.status(400).json({ error: '失败原因不能为空' });
      }

      await resendService.markResendFailed(resendId, failReason);

      res.json({
        success: true,
        message: '标记补发失败'
      });
    } catch (err) {
      console.error('标记补发失败失败:', err);
      res.status(500).json({ error: '标记补发失败失败' });
    }
  });

  return router;
};
