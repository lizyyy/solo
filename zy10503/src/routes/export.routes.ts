import { Router, Request, Response } from 'express';
import { ExportService } from '../services/export.service';
import type { Database } from '../database/schema';

export const createExportRouter = (db: Database) => {
  const router = Router();
  const exportService = new ExportService(db);

  router.get('/summary/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const csv = await exportService.exportSummaryToCsv(batchId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="summary_${batchId}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('导出统计CSV失败:', err);
      res.status(500).json({ error: '导出统计CSV失败' });
    }
  });

  router.get('/receipts/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const csv = await exportService.exportReceiptsToCsv(batchId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="receipts_${batchId}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('导回执CSV失败:', err);
      res.status(500).json({ error: '导回执CSV失败' });
    }
  });

  router.post('/summary/:batchId/generate', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const summary = await exportService.generateSummary(batchId);

      res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      console.error('生成统计失败:', err);
      res.status(500).json({ error: '生成统计失败' });
    }
  });

  router.get('/summary/:batchId/latest', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const summaries = await exportService.getSummary(batchId);

      res.json({
        success: true,
        data: summaries[0] || null
      });
    } catch (err) {
      console.error('获取统计失败:', err);
      res.status(500).json({ error: '获取统计失败' });
    }
  });

  return router;
};
