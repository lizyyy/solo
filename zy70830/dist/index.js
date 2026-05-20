"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const ReconciliationController_1 = require("./controllers/ReconciliationController");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'bed-reconciliation-service'
    });
});
app.post('/api/import/beds', (req, res) => ReconciliationController_1.reconciliationController.importBedCSV(req, res));
app.post('/api/import/patients', (req, res) => ReconciliationController_1.reconciliationController.importPatientJSON(req, res));
app.post('/api/import/workorders', (req, res) => ReconciliationController_1.reconciliationController.importCleaningWorkOrdersJSON(req, res));
app.post('/api/reconciliation/run', (req, res) => ReconciliationController_1.reconciliationController.runReconciliation(req, res));
app.get('/api/reconciliation/records', (req, res) => ReconciliationController_1.reconciliationController.getReconciliationRecords(req, res));
app.get('/api/reconciliation/report/:recordId', (req, res) => ReconciliationController_1.reconciliationController.generateReconciliationReport(req, res));
app.get('/api/discrepancies', (req, res) => ReconciliationController_1.reconciliationController.getDiscrepancies(req, res));
app.get('/api/discrepancies/:discrepancyId', (req, res) => ReconciliationController_1.reconciliationController.getDiscrepancy(req, res));
app.put('/api/discrepancies/:discrepancyId/review', (req, res) => ReconciliationController_1.reconciliationController.reviewDiscrepancy(req, res));
app.post('/api/discrepancies/batch-review', (req, res) => ReconciliationController_1.reconciliationController.batchReview(req, res));
app.get('/api/beds', (req, res) => ReconciliationController_1.reconciliationController.getBeds(req, res));
app.get('/api/patients', (req, res) => ReconciliationController_1.reconciliationController.getPatients(req, res));
app.get('/api/patients/:patientId/audit-trail', (req, res) => ReconciliationController_1.reconciliationController.getPatientAuditTrail(req, res));
app.get('/api/patients/:patientId/full-report', (req, res) => ReconciliationController_1.reconciliationController.getPatientFullReport(req, res));
app.get('/api/workorders', (req, res) => ReconciliationController_1.reconciliationController.getWorkOrders(req, res));
app.get('/api/statistics/summary', (req, res) => ReconciliationController_1.reconciliationController.getSummaryStatistics(req, res));
app.get('/api/dashboard', (req, res) => ReconciliationController_1.reconciliationController.getDashboardData(req, res));
app.get('/api/export/discrepancies/csv', (req, res) => ReconciliationController_1.reconciliationController.exportDiscrepanciesCSV(req, res));
app.get('/api/export/beds/csv', (req, res) => ReconciliationController_1.reconciliationController.exportBedsCSV(req, res));
app.get('/api/export/patients/csv', (req, res) => ReconciliationController_1.reconciliationController.exportPatientsCSV(req, res));
app.get('/api/export/workorders/csv', (req, res) => ReconciliationController_1.reconciliationController.exportWorkOrdersCSV(req, res));
app.get('/api/validate/consistency', (req, res) => ReconciliationController_1.reconciliationController.validateConsistency(req, res));
app.delete('/api/data/all', (req, res) => ReconciliationController_1.reconciliationController.clearAllData(req, res));
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});
app.use((err, req, res, next) => {
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
//# sourceMappingURL=index.js.map