import { Router, Request, Response } from 'express';
import multer from 'multer';
import importService from '../services/importService';
import reconciliationService from '../services/reconciliationService';
import reportService, { ReportFormat } from '../services/reportService';
import dataStore from '../store/dataStore';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/batches', (req: Request, res: Response) => {
  try {
    const { month, createdBy, name } = req.body;
    if (!month || !createdBy) {
      return res.status(400).json({ error: '缺少必要参数：month, createdBy' });
    }
    const batch = reconciliationService.createBatch(month, createdBy, name);
    res.json(batch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches', (req: Request, res: Response) => {
  try {
    const batches = dataStore.getAllBatches();
    res.json(batches);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches/:batchId', (req: Request, res: Response) => {
  try {
    const batch = dataStore.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/subsidy', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await importService.importSubsidyJson(req.file);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/swipe', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await importService.importSwipeCsv(req.file);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/refund', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    const result = await importService.importRefundCsv(req.file);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/batches/:batchId/process', async (req: Request, res: Response) => {
  try {
    const batch = await reconciliationService.processBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches/:batchId/details', (req: Request, res: Response) => {
  try {
    const details = dataStore.getDetailsByBatch(req.params.batchId);
    res.json(details);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches/:batchId/details/:detailId', (req: Request, res: Response) => {
  try {
    const detail = dataStore.getDetail(req.params.detailId);
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }
    res.json(detail);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/details/:detailId/review', (req: Request, res: Response) => {
  try {
    const { reviewer, action, comments, adjustedAmount } = req.body;
    if (!reviewer || !action || !comments) {
      return res.status(400).json({ error: '缺少必要参数：reviewer, action, comments' });
    }
    const detail = reconciliationService.reviewDetail(
      req.params.detailId,
      reviewer,
      action,
      comments,
      adjustedAmount
    );
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }
    res.json(detail);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/details/:detailId/recalculate', (req: Request, res: Response) => {
  try {
    const { reviewer } = req.body;
    if (!reviewer) {
      return res.status(400).json({ error: '缺少必要参数：reviewer' });
    }
    const detail = reconciliationService.recalculateDetail(
      req.params.detailId,
      reviewer
    );
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }
    res.json(detail);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/batches/:batchId/complete', (req: Request, res: Response) => {
  try {
    const batch = reconciliationService.completeBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/batches/:batchId/summary', (req: Request, res: Response) => {
  try {
    const summary = reconciliationService.getSummary(req.params.batchId);
    if (!summary) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/batches/:batchId/report/:format', async (req: Request, res: Response) => {
  try {
    const format = req.params.format as ReportFormat;
    if (!['xlsx', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: '不支持的格式，支持：xlsx, csv, pdf' });
    }

    const { filePath, fileName } = await reportService.generateReport(
      req.params.batchId,
      format
    );

    const contentType = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv; charset=utf-8',
      pdf: 'application/pdf'
    }[format];

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    const fs = require('fs');
    fs.createReadStream(filePath).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
