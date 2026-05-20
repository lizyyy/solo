import express from 'express';
import cors from 'cors';
import { reconciliationController } from './controllers/ReconciliationController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '快闪摊位对账服务运行正常' });
});

app.get('/api/applications', (req, res) => reconciliationController.getAllApplications(req, res));
app.get('/api/licenses', (req, res) => reconciliationController.getAllLicenses(req, res));
app.get('/api/venue-calendar', (req, res) => reconciliationController.getVenueCalendar(req, res));

app.post('/api/reconciliations', (req, res) => reconciliationController.createReconciliation(req, res));
app.post('/api/reconciliations/batch', (req, res) => reconciliationController.batchCreateReconciliations(req, res));
app.get('/api/reconciliations', (req, res) => reconciliationController.getAllReconciliations(req, res));
app.get('/api/reconciliations/:id', (req, res) => reconciliationController.getReconciliation(req, res));
app.post('/api/reconciliations/:id/review', (req, res) => reconciliationController.reviewDiscrepancy(req, res));
app.post('/api/reconciliations/:id/complete', (req, res) => reconciliationController.completeReconciliation(req, res));

app.get('/api/summary', (req, res) => reconciliationController.getSummary(req, res));

app.post('/api/import/applications', (req, res) => reconciliationController.importApplications(req, res));
app.post('/api/import/licenses', (req, res) => reconciliationController.importLicenses(req, res));
app.post('/api/import/venue-calendar', (req, res) => reconciliationController.importVenueCalendar(req, res));

app.get('/api/reconciliations/:id/export/csv', (req, res) => reconciliationController.exportReconciliationCSV(req, res));
app.get('/api/reconciliations/:id/export/pdf', (req, res) => reconciliationController.exportReconciliationPDF(req, res));
app.get('/api/export/summary/csv', (req, res) => reconciliationController.exportSummaryCSV(req, res));
app.get('/api/export/summary/pdf', (req, res) => reconciliationController.exportSummaryPDF(req, res));

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  快闪摊位对账服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`API 接口列表:`);
  console.log(`  GET  /api/health                          - 健康检查`);
  console.log(`  GET  /api/applications                    - 获取所有摊位申请`);
  console.log(`  GET  /api/licenses                        - 获取所有证照附件`);
  console.log(`  GET  /api/venue-calendar                  - 获取场地档期`);
  console.log(`  POST /api/reconciliations                 - 创建对账记录`);
  console.log(`  POST /api/reconciliations/batch           - 批量创建对账记录`);
  console.log(`  GET  /api/reconciliations                 - 获取所有对账记录`);
  console.log(`  GET  /api/reconciliations/:id             - 获取单个对账记录`);
  console.log(`  POST /api/reconciliations/:id/review      - 复核差异`);
  console.log(`  POST /api/reconciliations/:id/complete    - 完成对账`);
  console.log(`  GET  /api/summary                         - 获取对账汇总`);
  console.log(`  GET  /api/reconciliations/:id/export/csv  - 导出对账单CSV`);
  console.log(`  GET  /api/reconciliations/:id/export/pdf  - 导出对账单PDF`);
  console.log(`  GET  /api/export/summary/csv              - 导出汇总CSV`);
  console.log(`  GET  /api/export/summary/pdf              - 导出汇总PDF`);
  console.log(`\n样例数据已预置，包含：`);
  console.log(`  - 3个摊位申请`);
  console.log(`  - 3个证照附件（其中1个营业执照已过期）`);
  console.log(`  - 场地档期（包含时间冲突数据）`);
  console.log(`\n快速开始:`);
  console.log(`  1. 调用 POST /api/reconciliations/batch 批量创建对账记录`);
  console.log(`  2. 调用 GET  /api/reconciliations 查看对账结果`);
  console.log(`  3. 调用 POST /api/reconciliations/:id/review 复核差异`);
  console.log(`  4. 调用 GET  /api/reconciliations/:id/export/pdf 导出对账单\n`);
});
