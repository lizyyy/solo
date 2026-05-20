import express from 'express';
import multer from 'multer';
import { CsvImporter } from '../importers/csvImporter';
import { JsonImporter } from '../importers/jsonImporter';
import { ReconciliationService } from '../reconciliation/reconciliationService';
import { ReportGenerator } from '../report/reportGenerator';
import { ItemStatus, DifferenceType } from '../types';

export function createServer() {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });

  const csvImporter = new CsvImporter();
  const jsonImporter = new JsonImporter();
  const reconciliationService = new ReconciliationService();
  const reportGenerator = new ReportGenerator();

  app.use(express.json());

  app.post('/api/batches', upload.fields([
    { name: 'passengerCsv', maxCount: 1 },
    { name: 'driverCsv', maxCount: 1 },
    { name: 'warehouseCsv', maxCount: 1 },
    { name: 'routeJson', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const { batchName, createdBy } = req.body;

      let passengerItems: any[] = [];
      let driverItems: any[] = [];
      let warehouseItems: any[] = [];
      let routeSchedules: any[] = [];

      if (req.files?.passengerCsv?.[0]) {
        const csvContent = req.files.passengerCsv[0].buffer.toString('utf-8');
        const result = await csvImporter.importPassengerLostItems(csvContent);
        if (!result.success) {
          return res.status(400).json({ error: '乘客数据导入失败', details: result.errors });
        }
        passengerItems = result.data;
      }

      if (req.files?.driverCsv?.[0]) {
        const csvContent = req.files.driverCsv[0].buffer.toString('utf-8');
        const result = await csvImporter.importDriverTurnedInItems(csvContent);
        if (!result.success) {
          return res.status(400).json({ error: '司机数据导入失败', details: result.errors });
        }
        driverItems = result.data;
      }

      if (req.files?.warehouseCsv?.[0]) {
        const csvContent = req.files.warehouseCsv[0].buffer.toString('utf-8');
        const result = await csvImporter.importWarehouseItems(csvContent);
        if (!result.success) {
          return res.status(400).json({ error: '仓库数据导入失败', details: result.errors });
        }
        warehouseItems = result.data;
      }

      if (req.files?.routeJson?.[0]) {
        const jsonContent = req.files.routeJson[0].buffer.toString('utf-8');
        const result = jsonImporter.importRouteSchedules(jsonContent);
        if (!result.success) {
          return res.status(400).json({ error: '线路数据导入失败', details: result.errors });
        }
        routeSchedules = result.data;
      }

      const batch = reconciliationService.createBatch(
        batchName || '对账批次',
        createdBy || '系统',
        passengerItems,
        driverItems,
        warehouseItems,
        routeSchedules
      );

      const matches = reconciliationService.runMatching(batch.id);

      res.json({
        success: true,
        batch,
        matchCount: matches.length,
        matches: matches.slice(0, 20)
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/batches', (req, res) => {
    const batches = reconciliationService.getAllBatches();
    res.json({ batches });
  });

  app.get('/api/batches/:batchId', (req, res) => {
    const batch = reconciliationService.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    const matches = reconciliationService.getBatchMatches(req.params.batchId);
    res.json({ batch, matches });
  });

  app.get('/api/batches/:batchId/matches', (req, res) => {
    const { status, hasDifference, isOverdue } = req.query;

    const filters: any = {};
    if (status) filters.status = status as ItemStatus;
    if (hasDifference) filters.hasDifference = hasDifference as DifferenceType;
    if (isOverdue !== undefined) filters.isOverdue = isOverdue === 'true';

    const matches = reconciliationService.searchMatches(req.params.batchId, filters);
    res.json({ matches });
  });

  app.get('/api/batches/:batchId/matches/:matchId', (req, res) => {
    const detail = reconciliationService.getMatchDetail(req.params.batchId, req.params.matchId);
    if (!detail.match) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }
    res.json(detail);
  });

  app.post('/api/batches/:batchId/matches/:matchId/approve', (req, res) => {
    const { reviewer, reason } = req.body;
    const result = reconciliationService.approveMatch(
      req.params.batchId,
      req.params.matchId,
      reviewer || '未知用户',
      reason || '审批通过'
    );
    if (!result) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }
    res.json({ success: true, match: result });
  });

  app.post('/api/batches/:batchId/matches/:matchId/reject', (req, res) => {
    const { reviewer, reason } = req.body;
    const result = reconciliationService.rejectMatch(
      req.params.batchId,
      req.params.matchId,
      reviewer || '未知用户',
      reason || '审批驳回'
    );
    if (!result) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }
    res.json({ success: true, match: result });
  });

  app.post('/api/batches/:batchId/matches/:matchId/manual-match', (req, res) => {
    const { reviewer, reason, passengerItemId, driverItemId, warehouseItemId } = req.body;
    const result = reconciliationService.manualMatch(
      req.params.batchId,
      req.params.matchId,
      reviewer || '未知用户',
      reason || '人工匹配',
      { passengerItemId, driverItemId, warehouseItemId }
    );
    if (!result) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }
    res.json({ success: true, match: result });
  });

  app.post('/api/batches/:batchId/matches/:matchId/unmatch', (req, res) => {
    const { reviewer, reason } = req.body;
    const result = reconciliationService.unmatch(
      req.params.batchId,
      req.params.matchId,
      reviewer || '未知用户',
      reason || '解除匹配'
    );
    if (!result) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }
    res.json({ success: true, match: result });
  });

  app.post('/api/batches/:batchId/recalculate', (req, res) => {
    try {
      const matches = reconciliationService.recalculateMatching(req.params.batchId);
      res.json({ success: true, matchCount: matches.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/batches/:batchId/complete', (req, res) => {
    const result = reconciliationService.completeBatch(req.params.batchId);
    if (!result) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json({ success: true, batch: result });
  });

  app.get('/api/batches/:batchId/report', (req, res) => {
    try {
      const reportData = reconciliationService.generateReport(req.params.batchId);
      const { format } = req.query;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.batchId}.json"`);
        res.send(reportGenerator.generateJsonReport(reportData));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.batchId}.csv"`);
        res.send('\uFEFF' + reportGenerator.generateCsvReport(reportData));
      } else if (format === 'excel') {
        const excelBuffer = reportGenerator.generateExcelReport(reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.batchId}.xlsx"`);
        res.send(excelBuffer);
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(reportGenerator.generateTextReport(reportData));
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/batches/:batchId/matches/:matchId/audit-report', (req, res) => {
    const detail = reconciliationService.getMatchDetail(req.params.batchId, req.params.matchId);
    if (!detail.match) {
      return res.status(404).json({ error: '匹配记录不存在' });
    }

    const auditReport = reportGenerator.generateAuditTrailReport(
      detail.match,
      detail.passengerItem,
      detail.driverItem,
      detail.warehouseItem,
      detail.reviewHistory
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(auditReport);
  });

  app.get('/api/batches/:batchId/items', (req, res) => {
    const items = reconciliationService.getBatchItems(req.params.batchId);
    res.json(items);
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'bus-lost-found-reconciliation' });
  });

  return app;
}
