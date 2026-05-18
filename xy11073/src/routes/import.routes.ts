import express, { Request, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { ImportService } from '../services/import.service';
import { ExportService } from '../services/export.service';
import { ManualReviewRequest } from '../types';

const router = express.Router();
const importService = new ImportService();
const exportService = new ExportService();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const rawData: any[] = [];
    
    if (req.file.originalname.endsWith('.csv')) {
      const stream = Readable.from(req.file.buffer.toString());
      await new Promise((resolve, reject) => {
        stream.pipe(csv())
          .on('data', (data) => rawData.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (req.file.originalname.endsWith('.json')) {
      const jsonData = JSON.parse(req.file.buffer.toString());
      rawData.push(...(Array.isArray(jsonData) ? jsonData : [jsonData]));
    } else {
      return res.status(400).json({ error: '不支持的文件格式，请上传CSV或JSON文件' });
    }

    const result = importService.importData(rawData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '导入失败', message: (error as Error).message });
  }
});

router.post('/json', (req: Request, res: Response) => {
  try {
    const { data, existingBookings } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: '请提供有效的数据数组' });
    }

    const result = importService.importData(data, existingBookings || []);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '导入失败', message: (error as Error).message });
  }
});

router.post('/review', (req: Request, res: Response) => {
  try {
    const reviewRequest: ManualReviewRequest = req.body;
    const result = importService.reviewBadRecord(reviewRequest);
    
    if (!result) {
      return res.status(404).json({ error: '未找到对应的导入批次或记录' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '审核失败', message: (error as Error).message });
  }
});

router.get('/result/:batchId', (req: Request, res: Response) => {
  try {
    const result = importService.getImportResult(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '未找到导入结果' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '查询失败', message: (error as Error).message });
  }
});

router.get('/export/:batchId/json', (req: Request, res: Response) => {
  try {
    const result = importService.getImportResult(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '未找到导入结果' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="import-result-${req.params.batchId}.json"`);
    res.send(exportService.exportToJSON(result));
  } catch (error) {
    res.status(500).json({ error: '导出失败', message: (error as Error).message });
  }
});

router.get('/export/:batchId/report', (req: Request, res: Response) => {
  try {
    const result = importService.getImportResult(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '未找到导入结果' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="import-report-${req.params.batchId}.txt"`);
    res.send(exportService.exportFullReport(result));
  } catch (error) {
    res.status(500).json({ error: '导出失败', message: (error as Error).message });
  }
});

router.get('/export/:batchId/csv', (req: Request, res: Response) => {
  try {
    const result = importService.getImportResult(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '未找到导入结果' });
    }
    const { normalCSV, badCSV } = exportService.exportToCSV(result);
    res.json({
      normalRecordsCSV: normalCSV,
      badRecordsCSV: badCSV
    });
  } catch (error) {
    res.status(500).json({ error: '导出失败', message: (error as Error).message });
  }
});

router.get('/results', (req: Request, res: Response) => {
  try {
    const results = importService.getAllImportResults();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: '查询失败', message: (error as Error).message });
  }
});

export default router;
