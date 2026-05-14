import { Router, Request, Response } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { Parser } from 'json2csv';
import { store } from '../store/memoryStore';
import { syncEngine } from '../services/syncEngine';
import { SyncStatus, RowStatus } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/templates', (req: Request, res: Response) => {
  const templates = store.getAllTemplates();
  res.json(templates);
});

router.get('/mappings', (req: Request, res: Response) => {
  const mappings = store.getAllMappings();
  res.json(mappings);
});

router.get('/batches', (req: Request, res: Response) => {
  const { page, pageSize, status, mappingId } = req.query;
  const result = store.getBatches({
    page: page ? parseInt(page as string) : undefined,
    pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    status: status as SyncStatus,
    mappingId: mappingId as string
  });
  res.json(result);
});

router.get('/batches/:batchId', (req: Request, res: Response) => {
  const batch = store.getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  res.json(batch);
});

router.get('/batches/:batchId/rows', (req: Request, res: Response) => {
  const rows = store.getRowsByBatchId(req.params.batchId);
  res.json(rows);
});

router.post('/batches', upload.single('csv'), async (req: Request, res: Response) => {
  try {
    const { mappingId } = req.body;
    const file = req.file;

    if (!mappingId) {
      return res.status(400).json({ error: 'mappingId is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const mapping = store.getMapping(mappingId);
    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    const rows: any[] = [];
    const stream = Readable.from(file.buffer.toString());
    const parser = csvParser();

    await new Promise((resolve, reject) => {
      stream.pipe(parser)
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    const batch = store.createBatch({
      mappingId,
      fileName: file.originalname,
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      successRows: 0,
      failedRows: 0,
      status: SyncStatus.PENDING
    });

    store.createRows(rows.map((rowData, index) => ({
      batchId: batch.id,
      rowNumber: index + 1,
      rawData: rowData,
      status: RowStatus.PENDING,
      retryCount: 0
    })));

    res.status(201).json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batches/:batchId/validate', async (req: Request, res: Response) => {
  try {
    await syncEngine.validateBatch(req.params.batchId);
    const batch = store.getBatch(req.params.batchId);
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batches/:batchId/process', async (req: Request, res: Response) => {
  try {
    await syncEngine.processBatch(req.params.batchId);
    const batch = store.getBatch(req.params.batchId);
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batches/:batchId/retry', async (req: Request, res: Response) => {
  try {
    const { rowIds } = req.body;
    await syncEngine.retryFailedRows(req.params.batchId, rowIds);
    const batch = store.getBatch(req.params.batchId);
    res.json(batch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batchId/report', (req: Request, res: Response) => {
  try {
    const report = syncEngine.generateReport(req.params.batchId);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batchId/export', (req: Request, res: Response) => {
  try {
    const report = syncEngine.generateReport(req.params.batchId);

    const exportData = report.details.map(detail => ({
      行号: detail.rowNumber,
      状态: detail.status,
      ...detail.rawData,
      验证错误: detail.errors?.join('; ') || '',
      同步错误: detail.errorMessage || '',
      API响应: detail.apiResponse ? JSON.stringify(detail.apiResponse) : ''
    }));

    const parser = new Parser();
    const csv = parser.parse(exportData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sync-report-${req.params.batchId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', (req: Request, res: Response) => {
  const { batches } = store.getBatches({ page: 1, pageSize: 1000 });
  
  const stats = {
    totalBatches: batches.length,
    totalRows: batches.reduce((sum, b) => sum + b.totalRows, 0),
    successRows: batches.reduce((sum, b) => sum + b.successRows, 0),
    failedRows: batches.reduce((sum, b) => sum + b.failedRows, 0),
    byStatus: {} as Record<string, number>
  };

  for (const batch of batches) {
    stats.byStatus[batch.status] = (stats.byStatus[batch.status] || 0) + 1;
  }

  res.json(stats);
});

export default router;
