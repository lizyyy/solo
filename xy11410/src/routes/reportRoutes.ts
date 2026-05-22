import { Router, Request, Response } from 'express';
import { reportService } from '../services/ReportService';
import * as fs from 'fs';

const router = Router();

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await reportService.getStatistics({
      franchiseId: req.query.franchiseId as string,
      batchId: req.query.batchId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/franchise/:franchiseId', async (req: Request, res: Response) => {
  try {
    const report = await reportService.getFranchiseReport(req.params.franchiseId);
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/csv', async (req: Request, res: Response) => {
  try {
    const filePath = await reportService.exportToCSV({
      franchiseId: req.body.franchiseId,
      batchId: req.body.batchId,
      status: req.body.status,
      recordStatus: req.body.recordStatus
    });

    const fileName = filePath.split('/').pop();
    res.json({
      success: true,
      data: {
        filePath,
        fileName,
        downloadUrl: `/api/reports/download/${fileName}`
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export/franchise/:franchiseId/summary', async (req: Request, res: Response) => {
  try {
    const filePath = await reportService.exportFranchiseSummary(req.params.franchiseId);
    const fileName = filePath.split('/').pop();
    res.json({
      success: true,
      data: {
        filePath,
        fileName,
        downloadUrl: `/api/reports/download/${fileName}`
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/download/:fileName', async (req: Request, res: Response) => {
  try {
    const filePath = `${process.cwd()}/exports/${req.params.fileName}`;
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ success: false, error: '文件不存在' });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
