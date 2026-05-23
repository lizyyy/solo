import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import importService from '../services/importService';
import reconciliationEngine from '../services/reconciliationEngine';
import reviewService from '../services/reviewService';
import reportService from '../services/reportService';
import dataStore from '../store/dataStore';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/import/service-orders', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }
    const result = await importService.importServiceOrdersFromCSV(req.file.path);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/schedules', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }
    const result = await importService.importNurseSchedulesFromJSON(req.file.path);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/elders', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传JSON文件' });
    }
    const result = await importService.importElderProfilesFromJSON(req.file.path);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/reconciliation/start', (req: Request, res: Response) => {
  try {
    const { name, periodStart, periodEnd, createdBy } = req.body;
    
    if (!name || !periodStart || !periodEnd) {
      return res.status(400).json({ error: '缺少必填参数' });
    }

    const batch = dataStore.createBatch(name, periodStart, periodEnd, createdBy || 'system');
    const orders = dataStore.getServiceOrdersByDateRange(periodStart, periodEnd);
    const schedules = dataStore.getAllSchedules();
    const elders = dataStore.getAllElders();

    const records = reconciliationEngine.runReconciliation(batch.id, orders, schedules, elders);

    res.json({
      batchId: batch.id,
      batchName: batch.name,
      totalRecords: records.length,
      matchedCount: records.filter(r => r.status === 'matched').length,
      discrepancyCount: records.filter(r => r.status === 'discrepancy').length,
      records: records.slice(0, 50),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reconciliation/batches', (req: Request, res: Response) => {
  try {
    const batches = dataStore.getAllBatches();
    res.json(batches);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reconciliation/batch/:batchId', (req: Request, res: Response) => {
  try {
    const batch = dataStore.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    const records = dataStore.getRecordsByBatch(req.params.batchId);
    res.json({ batch, records });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reconciliation/record/:recordId', (req: Request, res: Response) => {
  try {
    const record = dataStore.getReconciliationRecord(req.params.recordId);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review/:recordId/approve', (req: Request, res: Response) => {
  try {
    const { operator, remark } = req.body;
    const record = reviewService.approve(req.params.recordId, operator || 'admin', remark);
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review/:recordId/reject', (req: Request, res: Response) => {
  try {
    const { operator, remark } = req.body;
    const record = reviewService.reject(req.params.recordId, operator || 'admin', remark);
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review/:recordId/supplement', (req: Request, res: Response) => {
  try {
    const { operator, remark } = req.body;
    const record = reviewService.requestSupplement(req.params.recordId, operator || 'admin', remark);
    res.json(record);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/review/batch/approve', (req: Request, res: Response) => {
  try {
    const { recordIds, operator, remark } = req.body;
    if (!recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({ error: '请提供 recordIds 数组' });
    }
    const result = reviewService.batchApprove(recordIds, operator || 'admin', remark);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/review/:recordId/audit-trail', (req: Request, res: Response) => {
  try {
    const logs = reviewService.getRecordAuditTrail(req.params.recordId);
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/review/:recordId/explain', (req: Request, res: Response) => {
  try {
    const explanation = reviewService.explainDecision(req.params.recordId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(explanation);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/report/:batchId/summary', (req: Request, res: Response) => {
  try {
    const summary = reportService.generateSummary(req.params.batchId);
    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/report/:batchId/details', (req: Request, res: Response) => {
  try {
    const details = reportService.generateDetails(req.params.batchId);
    res.json(details);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/report/:batchId/export/excel', (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const outputPath = path.join(exportDir, `report_${req.params.batchId}.xlsx`);
    reportService.exportToExcel(req.params.batchId, outputPath);
    res.download(outputPath);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/report/:batchId/export/csv', (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const outputPath = path.join(exportDir, `report_${req.params.batchId}.csv`);
    reportService.exportToCSV(req.params.batchId, outputPath);
    res.download(outputPath);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/traceability/:recordId', (req: Request, res: Response) => {
  try {
    const chain = reportService.getTraceability(req.params.recordId);
    res.json(chain);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/traceability/:recordId/full', (req: Request, res: Response) => {
  try {
    const chain = reportService.getFullTraceabilityChain(req.params.recordId);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(chain);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/data/elders', (req: Request, res: Response) => {
  res.json(dataStore.getAllElders());
});

router.get('/data/schedules', (req: Request, res: Response) => {
  res.json(dataStore.getAllSchedules());
});

router.get('/data/orders', (req: Request, res: Response) => {
  res.json(dataStore.getAllServiceOrders());
});

export default router;
