import express from 'express';
import { importTicketCsv } from './import/ticket-importer';
import { addTrackRemark, retainReworkRemark, reviewReworkRemark } from './track/remark-manager';
import { addAudioFileRemark, addRehearsalChange } from './track/audio-rehearsal-manager';
import { recalculateClassification } from './classification/classifier';
import { runAllChecks } from './self-check/checks';
import { 
  getAllTicketRowViews, 
  getTicketRowDetailView, 
  getRehearsalChangeDetail,
  getExportRows 
} from './unified-output/data-layer';
import { stringify } from 'csv-stringify/sync';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '音乐夏令营分班系统运行中' });
});

app.post('/api/import', (req, res) => {
  try {
    const { csvContent, fileName, importedBy, forceReimport } = req.body;
    const result = importTicketCsv(csvContent, fileName, importedBy, forceReimport);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/tickets', (req, res) => {
  const data = getAllTicketRowViews();
  res.json({ success: true, data });
});

app.get('/api/tickets/:id', (req, res) => {
  const data = getTicketRowDetailView(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({ success: true, data });
});

app.post('/api/tickets/:id/audio-remark', (req, res) => {
  const { audioRemark, addedBy } = req.body;
  const success = addAudioFileRemark(req.params.id, audioRemark, addedBy);
  res.json({ success });
});

app.post('/api/tickets/:id/track-remark', (req, res) => {
  const { type, content, addedBy, isReworkReason, retainReason } = req.body;
  const result = addTrackRemark(req.params.id, type, content, addedBy, isReworkReason, retainReason);
  res.json({ success: !!result, data: result });
});

app.post('/api/tickets/:id/rehearsal-change', (req, res) => {
  const { changeType, oldValue, newValue, reason, changedBy, relatedRemarkId } = req.body;
  const result = addRehearsalChange(req.params.id, changeType, oldValue, newValue, reason, changedBy, relatedRemarkId);
  res.json({ success: !!result, data: result });
});

app.get('/api/tickets/:rowId/rehearsal-changes/:changeId', (req, res) => {
  const data = getRehearsalChangeDetail(req.params.rowId, req.params.changeId);
  if (!data) {
    return res.status(404).json({ success: false, error: '变更记录不存在' });
  }
  res.json({ success: true, data });
});

app.post('/api/tickets/:id/review-rework', (req, res) => {
  const { remarkId, reviewedBy, approveAsNormal } = req.body;
  const success = reviewReworkRemark(req.params.id, remarkId, reviewedBy, approveAsNormal);
  res.json({ success });
});

app.post('/api/recalculate', (req, res) => {
  const { updatedBy } = req.body;
  const result = recalculateClassification(updatedBy || '系统');
  res.json({ success: true, data: result });
});

app.get('/api/self-check', (req, res) => {
  const results = runAllChecks();
  const allPassed = results.every(r => r.passed);
  res.json({ success: true, allPassed, data: results });
});

app.get('/api/export', (req, res) => {
  const rows = getExportRows();
  const csv = stringify(rows, { header: true });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=music-camp-classification.csv');
  res.send('\uFEFF' + csv);
});

app.listen(PORT, () => {
  console.log(`🎵 音乐夏令营分班系统已启动: http://localhost:${PORT}`);
  console.log(`   API文档:`);
  console.log(`   GET  /api/health           - 健康检查`);
  console.log(`   POST /api/import           - 导入票务CSV`);
  console.log(`   GET  /api/tickets          - 获取所有记录（列表页用）`);
  console.log(`   GET  /api/tickets/:id      - 获取单条记录详情`);
  console.log(`   POST /api/tickets/:id/audio-remark  - 添加音频备注`);
  console.log(`   POST /api/tickets/:id/track-remark  - 添加轨道备注`);
  console.log(`   POST /api/tickets/:id/rehearsal-change - 添加排练变更`);
  console.log(`   GET  /api/tickets/:rowId/rehearsal-changes/:changeId - 查看排练变更详情`);
  console.log(`   POST /api/tickets/:id/review-rework  - 复核返工原因`);
  console.log(`   POST /api/recalculate      - 重算分班结果`);
  console.log(`   GET  /api/self-check       - 执行自检`);
  console.log(`   GET  /api/export           - 导出CSV（与页面、接口同一份数据）`);
});
