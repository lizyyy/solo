import { Router, Request, Response } from 'express';
import exportService from '../services/ExportService.js';
import singleSourceService from '../services/SingleSourceService.js';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const batchId = req.params.id;

    if (format === 'csv') {
      const { content, fingerprint } = await exportService.exportToCSV(batchId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="settlement_${batchId}.csv"`);
      res.setHeader('X-Data-Fingerprint', fingerprint);
      res.send('\uFEFF' + content);
    } else {
      const { buffer, fingerprint } = await exportService.exportToXLSX(batchId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="settlement_${batchId}.xlsx"`);
      res.setHeader('X-Data-Fingerprint', fingerprint);
      res.send(buffer);
    }
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

router.get('/:id/consistency-check', async (req: Request, res: Response) => {
  try {
    const result = await singleSourceService.checkConsistency(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('一致性校验失败:', error);
    res.status(500).json({ error: '一致性校验失败' });
  }
});

router.get('/:id/replay-command', (req: Request, res: Response) => {
  try {
    const result = exportService.generateReplayCommand(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('生成重跑命令失败:', error);
    res.status(500).json({ error: '生成重跑命令失败' });
  }
});

export default router;
