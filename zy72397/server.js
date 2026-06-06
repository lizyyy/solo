const express = require('express');
const cors = require('cors');
const path = require('path');
const dataStore = require('./src/store/data-store');
const workflowEngine = require('./src/engine/workflow-engine');
const { STATUS } = require('./src/models/boundary-rules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/records', (req, res) => {
  const { status, turbineId, needsQcReview } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (turbineId) filters.turbineId = turbineId;
  if (needsQcReview === 'true') filters.needsQcReview = true;
  
  const data = dataStore.getUnifiedView(filters);
  res.json({
    success: true,
    data: data,
    source: 'unified-view',
    note: '页面、导出、API 共用此数据源'
  });
});

app.get('/api/records/:id', (req, res) => {
  const record = dataStore.getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({
    success: true,
    data: dataStore._formatForView(record),
    source: 'unified-view'
  });
});

app.get('/api/records/:id/audit', (req, res) => {
  try {
    const audit = workflowEngine.replayAuditLog(req.params.id);
    res.json({ success: true, data: audit });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/export', (req, res) => {
  const format = req.query.format || 'json';
  const data = dataStore.getExportData(format);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="turbine-efficiency.csv"');
    res.send('\uFEFF' + data);
  } else {
    res.json({
      success: true,
      data: JSON.parse(data),
      source: 'unified-view',
      note: '与页面展示、API 返回是同一份数据'
    });
  }
});

app.get('/api/statistics', (req, res) => {
  res.json({
    success: true,
    data: dataStore.getStatistics()
  });
});

app.post('/api/import', (req, res) => {
  try {
    let data, operator;
    if (Array.isArray(req.body)) {
      data = req.body;
      operator = 'system';
    } else {
      data = req.body.data;
      operator = req.body.operator;
    }
    const result = workflowEngine.importSensorData(data, operator || 'system');
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/engineer-review', (req, res) => {
  try {
    const { operator, notes, photoUrls } = req.body;
    const record = workflowEngine.engineerReview(
      req.params.id,
      operator || '何工',
      notes,
      photoUrls || []
    );
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/submit-qc', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const record = workflowEngine.submitForQcReview(req.params.id, operator || '何工', remark);
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/qc-approve', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const record = workflowEngine.qcApprove(req.params.id, operator || '质检员', remark);
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/qc-reject', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const record = workflowEngine.qcReject(req.params.id, operator || '质检员', reason);
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/finalize', (req, res) => {
  try {
    const { operator, conclusion } = req.body;
    const record = workflowEngine.finalizeConclusion(req.params.id, operator || '何工', conclusion);
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/rework', (req, res) => {
  try {
    const { operator, reason, photoUrls } = req.body;
    const result = workflowEngine.createRework(
      req.params.id,
      operator || '何工',
      reason,
      photoUrls || []
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/rollback', (req, res) => {
  try {
    const { operator, versionIndex } = req.body;
    const record = workflowEngine.rollbackToVersion(req.params.id, versionIndex, operator || 'system');
    res.json({ success: true, data: dataStore._formatForView(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/boundary-rules', (req, res) => {
  res.json({
    success: true,
    data: {
      max_sampling_gap_minutes: 30,
      min_sampling_duration_ratio: 0.5,
      theoretical_sampling_minutes: 60,
      status_list: STATUS,
      note: '边界规则与 README.md 保持同步'
    }
  });
});

app.listen(PORT, () => {
  console.log(`水轮机效率回放系统已启动: http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET  /api/records          - 获取记录列表（统一数据源）`);
  console.log(`  GET  /api/records/:id      - 获取单条记录详情`);
  console.log(`  GET  /api/records/:id/audit - 获取审计日志`);
  console.log(`  GET  /api/export           - 导出数据（与页面同一份）`);
  console.log(`  GET  /api/statistics       - 统计信息`);
  console.log(`  GET  /api/boundary-rules   - 边界规则`);
});

module.exports = app;
