import express from 'express';
import { store } from './store';
import { ruleEngine } from './engine/rule-engine';
import { sampleGenerator } from './data/sample-generator';
import { reportGenerator } from './report/generator';
import { outputFormatter } from './output/formatter';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let initialized = false;

function initializeData() {
  if (initialized) return;
  
  ruleEngine.createDefaultRules();
  const form = sampleGenerator.generateHandoverForm();
  sampleGenerator.createAnomalySamples(form.batchId, form.items);
  sampleGenerator.generateMembershipRenewalEdit();
  
  initialized = true;
}

app.use((req, res, next) => {
  initializeData();
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '内部包版本准入服务运行中' });
});

app.get('/api/handover', (req, res) => {
  const forms = store.getAllHandoverForms();
  res.json(forms);
});

app.get('/api/handover/:id', (req, res) => {
  const form = store.getHandoverForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: '未找到交接单' });
  }
  res.json(form);
});

app.get('/api/rules', (req, res) => {
  const rules = store.getAllRules();
  res.json(rules);
});

app.post('/api/validate', async (req, res) => {
  const { batchId, ruleVersion } = req.body;
  const form = store.getHandoverForm(batchId);
  
  if (!form) {
    return res.status(404).json({ error: '未找到批次' });
  }

  const report = await reportGenerator.generateBatchReport(
    form.batchId,
    form.items,
    ruleVersion
  );

  res.json(report);
});

app.get('/api/reports', (req, res) => {
  const reports = store.getAllReports();
  res.json(reports);
});

app.get('/api/reports/:id', (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: '未找到报告' });
  }
  res.json(report);
});

app.get('/api/reports/:id/markdown', (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: '未找到报告' });
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.send(outputFormatter.reportToMarkdown(report));
});

app.get('/api/reports/:id/download', (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: '未找到报告' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="report-${report.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(outputFormatter.toJSON(report));
});

app.get('/api/anomalies', (req, res) => {
  const anomalies = store.getAllAnomalies();
  res.json(anomalies);
});

app.get('/api/anomalies/:id', (req, res) => {
  const anomaly = store.getAnomaly(req.params.id);
  if (!anomaly) {
    return res.status(404).json({ error: '未找到异常样本' });
  }
  res.json(anomaly);
});

app.get('/api/anomalies/:id/original', (req, res) => {
  const anomaly = store.getAnomaly(req.params.id);
  if (!anomaly) {
    return res.status(404).json({ error: '未找到异常样本' });
  }
  res.json({
    anomalyId: anomaly.id,
    originalData: anomaly.originalData,
    canRestore: true,
  });
});

app.get('/api/history', (req, res) => {
  const history = store.getAllHistory();
  res.json(history);
});

app.get('/api/history/scope/:scope', (req, res) => {
  const history = store.getHistoryByScope(req.params.scope);
  res.json(history);
});

app.post('/api/compare', (req, res) => {
  const { batchId, oldVersion, newVersion } = req.body;
  const form = store.getHandoverForm(batchId);
  
  if (!form) {
    return res.status(404).json({ error: '未找到批次' });
  }

  const comparison = reportGenerator.compareRuleVersions(
    form.items,
    oldVersion,
    newVersion
  );

  res.json(comparison);
});

app.get('/api/compare/markdown', (req, res) => {
  const { batchId, oldVersion, newVersion } = req.query;
  const form = store.getAllHandoverForms()[0];
  
  if (!form) {
    return res.status(404).json({ error: '未找到批次' });
  }

  const comparison = reportGenerator.compareRuleVersions(
    form.items,
    String(oldVersion || '1.0.0'),
    String(newVersion || '1.1.0')
  );

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.send(outputFormatter.comparisonToMarkdown(comparison));
});

app.listen(PORT, () => {
  console.log(`内部包版本准入服务运行在 http://localhost:${PORT}`);
  console.log('API 端点:');
  console.log('  GET  /api/health - 健康检查');
  console.log('  GET  /api/handover - 获取所有交接单');
  console.log('  GET  /api/rules - 获取所有规则');
  console.log('  POST /api/validate - 校验批次');
  console.log('  GET  /api/reports - 获取所有报告');
  console.log('  GET  /api/reports/:id - 获取报告详情');
  console.log('  GET  /api/reports/:id/markdown - Markdown 格式报告');
  console.log('  GET  /api/reports/:id/download - 下载报告');
  console.log('  GET  /api/anomalies - 获取所有异常样本');
  console.log('  GET  /api/anomalies/:id/original - 查看原始材料');
  console.log('  GET  /api/history - 获取历史记录');
  console.log('  GET  /api/history/scope/:scope - 按资源范围获取历史记录');
  console.log('  POST /api/compare - 对比不同规则版本');
});

export { app };
