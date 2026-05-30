import { Router, type Request, type Response } from 'express';
import { ReportService } from '../services/ReportService.js';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = ReportService.getReports();
    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取报告列表失败',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const report = ReportService.getReport(id);

    if (!report) {
      res.status(404).json({
        success: false,
        error: '报告不存在',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取报告详情失败',
    });
  }
});

router.get('/:id/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query as { format?: 'csv' | 'json' };

    if (format !== 'csv' && format !== 'json') {
      res.status(400).json({
        success: false,
        error: 'format 必须是 csv 或 json',
      });
      return;
    }

    const result = ReportService.exportReport(id, format);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.status(200).send(result.content);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导出报告失败',
    });
  }
});

export default router;
