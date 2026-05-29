import express, { type Request, type Response } from 'express';
import reportRepository from '../repositories/reportRepository.js';
import reportService from '../services/reportService.js';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const reports = reportRepository.list();
    const enriched = reports.map(r => {
      const items = reportRepository.getItems(r.id);
      return { ...r, item_count: items.length };
    });
    res.json({ success: true, data: enriched });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', (req: Request, res: Response) => {
  try {
    const { script_ids, title } = req.body;
    const result = reportService.generateReport(script_ids || [], title || '');
    res.json({ success: true, data: result });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const report = reportRepository.getById(id);
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }
    const items = reportRepository.getItems(id);
    const enriched = items.map(i => ({ ...i, content: JSON.parse(i.content_json) }));
    res.json({ success: true, data: { report, items: enriched } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const format = (req.query.format as string) || 'json';
    if (!['json', 'csv', 'md'].includes(format)) {
      res.status(400).json({ success: false, error: '不支持的导出格式' });
      return;
    }
    const result = reportService.exportReport(id, format as 'json' | 'csv' | 'md');
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/review', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { item_id, review_status, review_note } = req.body;
    if (item_id) {
      reportRepository.updateItemReview(item_id, review_status, review_note);
    } else {
      reportRepository.updateStatus(id, review_status);
    }
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
