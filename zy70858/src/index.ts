import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

import { ImportService } from './services/ImportService';
import { ReconciliationEngine } from './services/ReconciliationEngine';
import { ReviewService } from './services/ReviewService';
import { ReportService } from './services/ReportService';
import { BorrowStatus, ReviewAction } from './types';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const importService = new ImportService();
const engine = new ReconciliationEngine();
const reviewService = new ReviewService(engine);
const reportService = new ReportService(engine, reviewService);

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '档案室借阅对账服务运行正常' });
});

app.post('/api/import/cases', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传案件JSON文件' });
    }

    const result = await importService.importCasesFromJSON(req.file.path);
    fs.unlinkSync(req.file.path);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/import/borrow-records', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传借阅CSV文件' });
    }

    const result = await importService.importBorrowRecordsFromCSV(req.file.path);
    fs.unlinkSync(req.file.path);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/import/permissions', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传人员权限JSON文件' });
    }

    const result = await importService.importUserPermissionsFromJSON(req.file.path);
    fs.unlinkSync(req.file.path);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/load-data', (req, res) => {
  try {
    const { cases, borrowRecords, permissions } = req.body;

    if (!cases || !borrowRecords || !permissions) {
      return res.status(400).json({ error: '缺少必要数据: cases, borrowRecords, permissions' });
    }

    engine.loadData(cases, borrowRecords, permissions);
    res.json({ success: true, message: '数据加载成功' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/reconcile', (req, res) => {
  try {
    const result = engine.runReconciliation();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/review/approve', (req, res) => {
  try {
    const { discrepancyId, reviewerId, reviewerName, reason } = req.body;

    if (!discrepancyId || !reviewerId || !reviewerName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = reviewService.approveDiscrepancy(discrepancyId, reviewerId, reviewerName, reason || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/review/reject', (req, res) => {
  try {
    const { recordId, reviewerId, reviewerName, reason } = req.body;

    if (!recordId || !reviewerId || !reviewerName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = reviewService.rejectBorrow(recordId, reviewerId, reviewerName, reason || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/review/request-info', (req, res) => {
  try {
    const { recordId, reviewerId, reviewerName, infoRequest } = req.body;

    if (!recordId || !reviewerId || !reviewerName || !infoRequest) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = reviewService.requestMoreInfo(recordId, reviewerId, reviewerName, infoRequest);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/review/manual-correction', (req, res) => {
  try {
    const { recordId, reviewerId, reviewerName, updates, reason } = req.body;

    if (!recordId || !reviewerId || !reviewerName || !updates) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = reviewService.manualCorrection(recordId, reviewerId, reviewerName, updates, reason || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/review/logs', (req, res) => {
  try {
    const { recordId } = req.query;
    const logs = reviewService.getReviewLogs(recordId as string);
    const summary = reviewService.getReviewSummary();
    res.json({ logs, summary });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/report', (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    const reportData = reportService.generateReportData(
      periodStart as string,
      periodEnd as string
    );
    res.json(reportData);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/report/pdf', async (req, res) => {
  try {
    const pdfBuffer = await reportService.generatePDFReport();
    const filename = `reconciliation-report-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/report/excel', async (req, res) => {
  try {
    const excelBuffer = await reportService.generateExcelReport();
    const filename = `reconciliation-report-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/data/cases', (req, res) => {
  try {
    const cases = engine.getAllCases();
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/data/borrow-records', (req, res) => {
  try {
    const records = engine.getAllBorrowRecords();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/data/permissions', (req, res) => {
  try {
    const permissions = engine.getAllUserPermissions();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`档案室借阅对账服务已启动: http://localhost:${port}`);
  console.log('');
  console.log('API接口说明:');
  console.log('  GET  /health                      - 健康检查');
  console.log('  POST /api/import/cases            - 导入案件JSON');
  console.log('  POST /api/import/borrow-records   - 导入借阅CSV');
  console.log('  POST /api/import/permissions      - 导入人员权限JSON');
  console.log('  POST /api/load-data               - 加载数据到对账引擎');
  console.log('  POST /api/reconcile               - 执行对账');
  console.log('  POST /api/review/approve          - 批准例外');
  console.log('  POST /api/review/reject           - 退回借阅');
  console.log('  POST /api/review/request-info     - 要求补充材料');
  console.log('  POST /api/review/manual-correction - 人工修正');
  console.log('  GET  /api/review/logs             - 获取复核记录');
  console.log('  GET  /api/report                  - 获取报告数据');
  console.log('  GET  /api/report/pdf              - 下载PDF报告');
  console.log('  GET  /api/report/excel            - 下载Excel报告');
  console.log('  GET  /api/data/cases              - 获取案件列表');
  console.log('  GET  /api/data/borrow-records     - 获取借阅记录');
  console.log('  GET  /api/data/permissions        - 获取人员权限');
  console.log('');
});

export default app;
