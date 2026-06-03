import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { dataStore } from '../models/index.js';
import {
  processAllAnswers,
  createReviewRecord,
  updateWithQuestionnaire,
  updateWithManualExample,
  generateReport,
  approveRecord
} from '../review/engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/records', (req, res) => {
  dataStore.loadFromFiles();
  const records = dataStore.getAllReviewRecords();
  res.json(records.map(r => r.toJSON()));
});

app.get('/api/records/:id', (req, res) => {
  dataStore.loadFromFiles();
  const record = dataStore.getReviewRecord(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(generateReport(req.params.id));
});

app.post('/api/records', (req, res) => {
  dataStore.loadFromFiles();
  const { studentId, answerId } = req.body;
  const record = createReviewRecord(studentId, answerId);
  if (!record) {
    return res.status(400).json({ error: '创建失败' });
  }
  dataStore.saveToFiles();
  res.json(record.toJSON());
});

app.post('/api/process', (req, res) => {
  dataStore.loadFromFiles();
  const records = processAllAnswers();
  res.json({ count: records.length, records: records.map(r => r.toJSON()) });
});

app.post('/api/records/:id/questionnaire', (req, res) => {
  dataStore.loadFromFiles();
  const updated = updateWithQuestionnaire(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(updated.toJSON());
});

app.post('/api/records/:id/manual', (req, res) => {
  dataStore.loadFromFiles();
  const updated = updateWithManualExample(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(updated.toJSON());
});

app.post('/api/records/:id/approve', (req, res) => {
  dataStore.loadFromFiles();
  const { approver } = req.body;
  const updated = approveRecord(req.params.id, approver || '系统');
  if (!updated) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(updated.toJSON());
});

app.get('/api/stats', (req, res) => {
  dataStore.loadFromFiles();
  const records = dataStore.getAllReviewRecords();

  const stats = {
    total: records.length,
    byStatus: {},
    hasMultipleVersions: 0,
    hasManual: 0,
    hasQuestionnaire: 0
  };

  records.forEach(r => {
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
    if (r.hasMultipleVersions) stats.hasMultipleVersions++;
    if (r.manualExample) stats.hasManual++;
    if (r.questionnaire) stats.hasQuestionnaire++;
  });

  res.json(stats);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`凸包围栏面积复核系统 - 小看板已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api`);
});
