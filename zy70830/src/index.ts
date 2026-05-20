import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { reconciliationController } from './controllers/ReconciliationController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'bed-reconciliation-service'
  });
});

app.post('/api/import/beds', (req, res) => reconciliationController.importBedCSV(req, res));
app.post('/api/import/patients', (req, res) => reconciliationController.importPatientJSON(req, res));
app.post('/api/import/workorders', (req, res) => reconciliationController.importCleaningWorkOrdersJSON(req, res));

app.post('/api/reconciliation/run', (req, res) => reconciliationController.runReconciliation(req, res));
app.get('/api/reconciliation/records', (req, res) => reconciliationController.getReconciliationRecords(req, res));
app.get('/api/reconciliation/report/:recordId', (req, res) => reconciliationController.generateReconciliationReport(req, res));

app.get('/api/discrepancies', (req, res) => reconciliationController.getDiscrepancies(req, res));
app.get('/api/discrepancies/:discrepancyId', (req, res) => reconciliationController.getDiscrepancy(req, res));
app.put('/api/discrepancies/:discrepancyId/review', (req, res) => reconciliationController.reviewDiscrepancy(req, res));
app.post('/api/discrepancies/batch-review', (req, res) => reconciliationController.batchReview(req, res));

app.get('/api/beds', (req, res) => reconciliationController.getBeds(req, res));
app.get('/api/patients', (req, res) => reconciliationController.getPatients(req, res));
app.get('/api/patients/:patientId/audit-trail', (req, res) => reconciliationController.getPatientAuditTrail(req, res));
app.get('/api/patients/:patientId/full-report', (req, res) => reconciliationController.getPatientFullReport(req, res));
app.get('/api/workorders', (req, res) => reconciliationController.getWorkOrders(req, res));

app.get('/api/statistics/summary', (req, res) => reconciliationController.getSummaryStatistics(req, res));
app.get('/api/dashboard', (req, res) => reconciliationController.getDashboardData(req, res));

app.get('/api/export/discrepancies/csv', (req, res) => reconciliationController.exportDiscrepanciesCSV(req, res));
app.get('/api/export/beds/csv', (req, res) => reconciliationController.exportBedsCSV(req, res));
app.get('/api/export/patients/csv', (req, res) => reconciliationController.exportPatientsCSV(req, res));
app.get('/api/export/workorders/csv', (req, res) => reconciliationController.exportWorkOrdersCSV(req, res));

app.get('/api/validate/consistency', (req, res) => reconciliationController.validateConsistency(req, res));
app.delete('/api/data/all', (req, res) => reconciliationController.clearAllData(req, res));

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
========================================
🏥 床位对账服务启动成功
📍 地址: http://localhost:${PORT}
📋 API文档:
   GET  /health - 健康检查
   
   POST /api/import/beds - 导入床位CSV
   POST /api/import/patients - 导入患者JSON
   POST /api/import/workorders - 导入保洁工单JSON
   
   POST /api/reconciliation/run - 运行对账
   GET  /api/reconciliation/records - 获取对账记录
   GET  /api/reconciliation/report/:id - 生成对账报告
   
   GET  /api/discrepancies - 获取差异列表
   GET  /api/discrepancies/:id - 获取差异详情
   PUT  /api/discrepancies/:id/review - 复核差异
   POST /api/discrepancies/batch-review - 批量复核
   
   GET  /api/patients/:patientId/audit-trail - 患者审计追踪
   GET  /api/patients/:patientId/full-report - 患者完整报告
   
   GET  /api/statistics/summary - 汇总统计
   GET  /api/dashboard - 仪表板数据
   
   GET  /api/export/*/csv - 导出CSV
   
   GET  /api/validate/consistency - 验证数据一致性
========================================
  `);
});
