import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { api } from './api';
import { ProcessingStatus } from './types';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.redirect('/index.html');
  }
});

app.get('/api/records', (req, res) => {
  const includeRolledBack = req.query.includeRolledBack === 'true';
  res.json({
    success: true,
    data: api.getRecordsForApi(includeRolledBack),
    source: '统一数据源 - getAllUnifiedRecords',
  });
});

app.get('/api/records/:id', (req, res) => {
  const record = api.getRecord(req.params.id);
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' });
    return;
  }
  res.json({
    success: true,
    data: record,
    source: '统一数据源 - getUnifiedRecordData',
  });
});

app.get('/api/records/:id/history', (req, res) => {
  const history = api.getRecordChangeHistory(req.params.id);
  if (history === null) {
    res.status(404).json({ success: false, error: '记录不存在' });
    return;
  }
  res.json({ success: true, data: history });
});

app.post('/api/import', (req, res) => {
  try {
    const { rows, importedBy, source } = req.body;
    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ success: false, error: 'rows 参数必须是数组' });
      return;
    }
    if (!importedBy) {
      res.status(400).json({ success: false, error: 'importedBy 必填' });
      return;
    }
    const result = api.importRecords(rows, importedBy, source || '授权期限页');
    res.json({
      success: true,
      data: result,
      message: `成功导入 ${result.records.length} 条记录（双名歌曲自动标记待老师复核）`,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/import-batches/:id/rollback', (req, res) => {
  try {
    const { rolledBackBy, reason } = req.body;
    if (!rolledBackBy || !reason) {
      res.status(400).json({ success: false, error: 'rolledBackBy 和 reason 必填' });
      return;
    }
    const result = api.rollbackImportBatch(req.params.id, rolledBackBy, reason);
    if (!result) {
      res.status(404).json({ success: false, error: '导入批次不存在' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/import-batches', (req, res) => {
  res.json({ success: true, data: api.getImportBatches() });
});

app.get('/api/import-batches/:id', (req, res) => {
  const batch = api.getImportBatch(req.params.id);
  if (!batch) {
    res.status(404).json({ success: false, error: '导入批次不存在' });
    return;
  }
  res.json({ success: true, data: batch });
});

app.post('/api/records/:id/status', (req, res) => {
  try {
    const { newStatus, updatedBy, reason } = req.body;
    if (!newStatus || !updatedBy || !reason) {
      res.status(400).json({ success: false, error: 'newStatus, updatedBy, reason 必填' });
      return;
    }
    const result = api.updateRecordStatus(
      req.params.id,
      newStatus as ProcessingStatus,
      updatedBy,
      reason
    );
    if (!result) {
      res.status(404).json({ success: false, error: '记录不存在或已撤回' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/engineer-message', (req, res) => {
  const { message, addedBy } = req.body;
  if (!message || !addedBy) {
    res.status(400).json({ success: false, error: 'message 和 addedBy 必填' });
    return;
  }
  const result = api.addEngineerMessage(req.params.id, message, addedBy);
  if (!result) {
    res.status(404).json({ success: false, error: '记录不存在或已撤回' });
    return;
  }
  res.json({ success: true, data: result });
});

app.post('/api/records/:id/rollback-status', (req, res) => {
  try {
    const { rolledBackBy, reason } = req.body;
    if (!rolledBackBy || !reason) {
      res.status(400).json({ success: false, error: 'rolledBackBy 和 reason 必填' });
      return;
    }
    const result = api.rollbackRecordStatus(req.params.id, rolledBackBy, reason);
    if (!result) {
      res.status(404).json({ success: false, error: '记录不存在或已撤回' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/export', (req, res) => {
  const includeRolledBack = req.query.includeRolledBack === 'true';
  const csv = api.getRecordsForExport(includeRolledBack);
  const filenameCn = `耳返频段冲突记录_${new Date().toISOString().slice(0, 10)}.csv`;
  const filenameEncoded = encodeURIComponent(filenameCn);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filenameEncoded}"; filename*=UTF-8''${filenameEncoded}`
  );
  res.setHeader('X-Data-Source', 'unified-datasource-exportRecords');
  res.send('\uFEFF' + csv);
});

app.post('/api/weekly-report', (req, res) => {
  try {
    const { createdBy } = req.body;
    if (!createdBy) {
      res.status(400).json({ success: false, error: 'createdBy 必填' });
      return;
    }
    const report = api.createWeeklyReport(createdBy);
    res.json({ success: true, data: report });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/weekly-report', (req, res) => {
  res.json({ success: true, data: api.getCurrentWeeklyReport() });
});

app.get('/api/weekly-report/versions', (req, res) => {
  res.json({ success: true, data: api.getWeeklyReportVersions() });
});

app.post('/api/weekly-report/rollback', (req, res) => {
  try {
    const prev = api.rollbackToPreviousReport();
    res.json({ success: true, data: prev });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  耳返频段冲突记录系统 已启动');
  console.log('============================================');
  console.log('');
  console.log(`  页面入口:   http://localhost:${PORT}/`);
  console.log(`  API 接口:   http://localhost:${PORT}/api/records`);
  console.log(`  导出 CSV:   http://localhost:${PORT}/api/export`);
  console.log('');
  console.log('  三步流程快速体验:');
  console.log('    1. 打开页面点"演示：授权期限页第一次导入"');
  console.log('    2. 补看调音师留言');
  console.log('    3. 生成给店长的周报');
  console.log('');
});
