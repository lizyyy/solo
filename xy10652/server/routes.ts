import express from 'express';
import {
  SupplierService,
  SampleBatchService,
  ReviewScoreService,
  RectificationOpinionService,
  ReshipLogisticsService,
  VersionFinalizationService,
  StatisticsService,
  ChangeLogService,
  ExportService
} from './services';

const router = express.Router();

router.get('/suppliers', (req, res) => {
  try {
    res.json(SupplierService.getAll());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/suppliers', (req, res) => {
  try {
    res.json(SupplierService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/suppliers/:id', (req, res) => {
  try {
    res.json(SupplierService.update(req.params.id, req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches', (req, res) => {
  try {
    res.json(SampleBatchService.getAll(req.query));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/:id', (req, res) => {
  try {
    const batch = SampleBatchService.getById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/validate/:batchNo', (req, res) => {
  try {
    const result = SampleBatchService.validateBatch(req.params.batchNo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/batches', (req, res) => {
  try {
    res.json(SampleBatchService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/batches/:id', (req, res) => {
  try {
    res.json(SampleBatchService.update(req.params.id, req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/:batchId/reviews', (req, res) => {
  try {
    res.json(ReviewScoreService.getByBatchId(req.params.batchId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/reviews', (req, res) => {
  try {
    res.json(ReviewScoreService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/reviews/:id', (req, res) => {
  try {
    res.json(ReviewScoreService.update(req.params.id, req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/:batchId/rectifications', (req, res) => {
  try {
    res.json(RectificationOpinionService.getByBatchId(req.params.batchId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/rectifications', (req, res) => {
  try {
    res.json(RectificationOpinionService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/rectifications/:id/advance', (req, res) => {
  try {
    res.json(RectificationOpinionService.advance(req.params.id, req.body.status, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/:batchId/logistics', (req, res) => {
  try {
    res.json(ReshipLogisticsService.getByBatchId(req.params.batchId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/logistics', (req, res) => {
  try {
    res.json(ReshipLogisticsService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/batches/:batchId/finalization', (req, res) => {
  try {
    res.json(VersionFinalizationService.getByBatchId(req.params.batchId) || null);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/finalizations', (req, res) => {
  try {
    res.json(VersionFinalizationService.create(req.body, req.body.changedBy || 'system'));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/statistics/overview', (req, res) => {
  try {
    res.json(StatisticsService.getOverview());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/change-logs/:tableName/:recordId', (req, res) => {
  try {
    res.json(ChangeLogService.getByRecord(req.params.tableName, req.params.recordId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export/report', async (req, res) => {
  try {
    const buffer = await ExportService.generateReport(req.query as any);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sample-review-report.xlsx');
    res.send(Buffer.from(buffer as any));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
