const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const {
  importDesensitizationRule,
  updateDesensitizationRule,
  addGrayBatch,
  updateGrayBatch,
  getDesensitizationRules,
  getDesensitizationRuleById,
  getGrayBatches,
  getGrayBatchById,
  getInspectionRecords,
  getInspectionById,
  getExportResults,
  getPhoneMaskIssues,
  getAuditLogs,
  updatePhoneMaskIssue,
  updateExportResult,
  traceBackByTraceId,
  traceBackByRagReference
} = require('./models');
const { runInspection, rerunInspection, generateFriendlyReport } = require('./inspectionEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RAG 引用缺失巡检服务运行中' });
});

app.get('/api/rules', (req, res) => {
  res.json(getDesensitizationRules());
});

function getOperator(req) {
  const op = req.headers['x-operator'] || req.body?.operator || '未知用户';
  try {
    return decodeURIComponent(op);
  } catch (e) {
    return op;
  }
}

app.post('/api/rules', (req, res) => {
  const operator = getOperator(req);
  const rule = importDesensitizationRule(req.body, operator);
  res.json(rule);
});

app.get('/api/batches', (req, res) => {
  res.json(getGrayBatches());
});

app.post('/api/batches', (req, res) => {
  const operator = getOperator(req);
  const batch = addGrayBatch(req.body, operator);
  res.json(batch);
});

app.get('/api/inspections', (req, res) => {
  res.json(getInspectionRecords());
});

app.post('/api/inspections/run', (req, res) => {
  const operator = getOperator(req);
  const result = runInspection(operator);
  res.json(result);
});

app.post('/api/inspections/:id/rerun', (req, res) => {
  const operator = getOperator(req);
  const result = rerunInspection(operator, req.params.id);
  res.json(result);
});

app.get('/api/exports', (req, res) => {
  res.json(getExportResults());
});

app.get('/api/exports/:id', (req, res) => {
  const exports = getExportResults();
  const exp = exports.find(e => e.id === req.params.id);
  if (!exp) return res.status(404).json({ error: '导出不存在' });
  res.json(exp);
});

app.put('/api/exports/:id', (req, res) => {
  const operator = getOperator(req);
  const updated = updateExportResult(req.params.id, req.body, operator);
  if (!updated) return res.status(404).json({ error: '导出不存在' });
  res.json(updated);
});

app.get('/api/phone-issues', (req, res) => {
  res.json(getPhoneMaskIssues());
});

app.put('/api/phone-issues/:id', (req, res) => {
  const operator = getOperator(req);
  const updated = updatePhoneMaskIssue(req.params.id, req.body, operator);
  if (!updated) return res.status(404).json({ error: '问题不存在' });
  res.json(updated);
});

app.get('/api/audit-logs', (req, res) => {
  res.json(getAuditLogs());
});

app.get('/api/rules/:id', (req, res) => {
  const rule = getDesensitizationRuleById(req.params.id);
  if (!rule) return res.status(404).json({ error: '规则不存在' });
  res.json(rule);
});

app.put('/api/rules/:id', (req, res) => {
  const operator = getOperator(req);
  const changeReason = req.body.changeReason || null;
  const updates = {};
  ['name', 'remark', 'mainProcess', 'content', 'status'].forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });
  const updated = updateDesensitizationRule(req.params.id, updates, operator, changeReason);
  if (!updated) return res.status(404).json({ error: '规则不存在' });
  res.json(updated);
});

app.get('/api/batches/:id', (req, res) => {
  const batch = getGrayBatchById(req.params.id);
  if (!batch) return res.status(404).json({ error: '批次不存在' });
  res.json(batch);
});

app.put('/api/batches/:id', (req, res) => {
  const operator = getOperator(req);
  const changeReason = req.body.changeReason || null;
  const updates = {};
  ['batchNo', 'sceneStatement', 'relatedRuleId', 'content'].forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });
  const updated = updateGrayBatch(req.params.id, updates, operator, changeReason);
  if (!updated) return res.status(404).json({ error: '批次不存在' });
  res.json(updated);
});

app.get('/api/inspections/:id', (req, res) => {
  const inspection = getInspectionById(req.params.id);
  if (!inspection) return res.status(404).json({ error: '巡检记录不存在' });
  res.json(inspection);
});

app.get('/api/trace/traceId/:traceId', (req, res) => {
  const result = traceBackByTraceId(req.params.traceId);
  if (!result.found) return res.status(404).json({ error: '未找到相关记录', ...result });
  res.json(result);
});

app.get('/api/trace/rag/:searchTerm', (req, res) => {
  const result = traceBackByRagReference(req.params.searchTerm);
  res.json(result);
});

app.get('/api/dashboard', (req, res) => {
  const rules = getDesensitizationRules();
  const batches = getGrayBatches();
  const inspections = getInspectionRecords();
  const phoneIssues = getPhoneMaskIssues();
  const exports = getExportResults();
  const auditLogs = getAuditLogs();

  const latestInspection = inspections.length > 0 ? inspections[inspections.length - 1] : null;
  const pendingPhoneIssues = phoneIssues.filter(p => p.status === 'pending_review');

  res.json({
    stats: {
      ruleCount: rules.length,
      batchCount: batches.length,
      inspectionCount: inspections.length,
      phoneIssueCount: phoneIssues.length,
      pendingPhoneIssueCount: pendingPhoneIssues.length,
      exportCount: exports.length,
      auditLogCount: auditLogs.length
    },
    latestInspection,
    recentAuditLogs: auditLogs.slice(-10).reverse(),
    pendingPhoneIssues
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  RAG 引用缺失巡检 - Web 小看板');
  console.log('========================================');
  console.log('');
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 可用入口:');
  console.log('  - Web 小看板: http://localhost:3000');
  console.log('  - API 接口:   http://localhost:3000/api');
  console.log('  - 命令行:     npm run cli');
  console.log('');
  console.log('💡 首次使用建议先运行: npm run demo');
  console.log('   生成演示数据后再打开小看板');
  console.log('========================================');
});
