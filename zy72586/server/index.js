const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Parser } = require('json2csv');
const db = require('./db');
const selfCheck = require('./selfCheck');

const app = express();
const PORT = 3001;
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadJSON() {
  if (!fs.existsSync(dbPath)) return {};
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch(e) { return {}; }
}

function addAuditLog(sampleId, action, oldValue, newValue, operator = 'system', remark = '') {
  db.prepare(`
    INSERT INTO sample_audit_logs (sample_id, action, old_value, new_value, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sampleId, action, oldValue, newValue, operator, remark);
}

app.get('/api/reports', (req, res) => {
  const data = loadJSON();
  const reports = (data.weekly_reports || []).map(r => {
    const sample_count = (data.negative_samples || []).filter(s => s.report_id == r.id).length;
    const recall_count = (data.recall_candidates || []).filter(c => c.report_id == r.id).length;
    return { ...r, sample_count, recall_count };
  });
  reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(reports);
});

app.post('/api/reports', (req, res) => {
  const { week_number, title, created_by } = req.body;
  try {
    const existing = loadJSON().weekly_reports?.find(r => r.week_number === week_number);
    if (existing) {
      return res.status(400).json({ error: '该周次周报已存在' });
    }
    const result = db.prepare(`
      INSERT INTO weekly_reports (week_number, title, created_by)
      VALUES (?, ?, ?)
    `).run(week_number, title, created_by || 'system');
    res.json({ id: result.lastInsertRowid, week_number, title });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/reports/:id', (req, res) => {
  const report = db.prepare(`SELECT * FROM weekly_reports WHERE id = ?`).get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

app.get('/api/reports/:id/samples', (req, res) => {
  const { status, anomaly_only } = req.query;
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  let samples = (data.negative_samples || []).filter(s => s.report_id === reportId);
  
  if (status) {
    samples = samples.filter(s => s.processing_status === status);
  }
  if (anomaly_only === '1') {
    samples = samples.filter(s => s.is_bucket_diff_anomaly === 1);
  }
  samples.sort((a, b) => a.original_line_no - b.original_line_no);
  
  res.json(samples);
});

app.post('/api/reports/:id/samples/import', (req, res) => {
  const reportId = parseInt(req.params.id);
  const { samples, operator } = req.body;
  
  const report = db.prepare(`SELECT * FROM weekly_reports WHERE id = ?`).get(reportId);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const insertStmt = db.prepare(`
    INSERT INTO negative_samples 
    (report_id, original_line_no, item_id, item_title, offline_score, online_score, 
     offline_bucket, online_bucket, bucket_diff, is_bucket_diff_anomaly, raw_data, processing_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  samples.forEach((s, idx) => {
    const bucketInfo = selfCheck.calculateBucketForSample(s);
    const result = insertStmt.run(
      reportId,
      s.original_line_no || (idx + 1),
      s.item_id,
      s.item_title || '',
      s.offline_score,
      s.online_score,
      bucketInfo.offline_bucket,
      bucketInfo.online_bucket,
      bucketInfo.bucket_diff,
      bucketInfo.is_bucket_diff_anomaly,
      JSON.stringify(s),
      'imported'
    );
    addAuditLog(result.lastInsertRowid, 'import', null, JSON.stringify(s), operator || 'system', '导入负样本');
  });

  const data = loadJSON();
  const count = (data.negative_samples || []).filter(s => s.report_id === reportId).length;
  res.json({ imported: samples.length, total: count });
});

app.patch('/api/samples/:id', (req, res) => {
  const sampleId = parseInt(req.params.id);
  const { manual_remark, processing_status, operator } = req.body;
  
  const data = loadJSON();
  const old = (data.negative_samples || []).find(s => s.id === sampleId);
  if (!old) return res.status(404).json({ error: 'Sample not found' });

  const updates = [];
  const params = [];
  
  if (manual_remark !== undefined) {
    updates.push('manual_remark = ?');
    params.push(manual_remark);
    addAuditLog(sampleId, 'update_manual_remark', old.manual_remark, manual_remark, operator, '人工备注更新');
  }
  if (processing_status !== undefined) {
    updates.push('processing_status = ?');
    params.push(processing_status);
    addAuditLog(sampleId, 'update_status', old.processing_status, processing_status, operator, '处理状态更新');
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No updates' });
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(sampleId);
  
  db.prepare(`UPDATE negative_samples SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const updated = loadJSON().negative_samples.find(s => s.id === sampleId);
  res.json(updated);
});

app.get('/api/samples/:id/audit', (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM sample_audit_logs 
    WHERE sample_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.id);
  res.json(logs);
});

app.get('/api/reports/:id/recalls', (req, res) => {
  const recalls = db.prepare(`
    SELECT * FROM recall_candidates 
    WHERE report_id = ? 
    ORDER BY added_at DESC
  `).all(req.params.id);
  res.json(recalls);
});

app.post('/api/reports/:id/recalls', (req, res) => {
  const reportId = parseInt(req.params.id);
  const { items, added_by } = req.body;
  
  const insertStmt = db.prepare(`
    INSERT INTO recall_candidates (report_id, sample_id, item_id, item_title, recall_source, recall_score, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach(item => {
    insertStmt.run(
      reportId,
      item.sample_id || null,
      item.item_id,
      item.item_title || '',
      item.recall_source || '',
      item.recall_score || null,
      added_by || 'linjie'
    );
    if (item.sample_id) {
      const data = loadJSON();
      const sample = (data.negative_samples || []).find(s => s.id === item.sample_id);
      if (sample) {
        db.prepare(`
          UPDATE negative_samples 
          SET recall_candidate_added = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(item.sample_id);
        addAuditLog(item.sample_id, 'link_recall', null, JSON.stringify(item), added_by || 'linjie', '关联召回候选');
      }
    }
  });

  res.json({ added: items.length });
});

app.post('/api/reports/:id/recalc', (req, res) => {
  const reportId = parseInt(req.params.id);
  const { operator } = req.body;
  
  const data = loadJSON();
  const samples = (data.negative_samples || []).filter(s => s.report_id === reportId);
  
  samples.forEach(s => {
    const bucketInfo = selfCheck.calculateBucketForSample(s);
    const oldAnomaly = s.is_bucket_diff_anomaly;
    db.prepare(`
      UPDATE negative_samples 
      SET offline_bucket = ?, online_bucket = ?, bucket_diff = ?, is_bucket_diff_anomaly = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      bucketInfo.offline_bucket,
      bucketInfo.online_bucket,
      bucketInfo.bucket_diff,
      bucketInfo.is_bucket_diff_anomaly,
      s.id
    );
    if (oldAnomaly !== bucketInfo.is_bucket_diff_anomaly) {
      addAuditLog(s.id, 'recalc_bucket', String(oldAnomaly), String(bucketInfo.is_bucket_diff_anomaly), operator, '补录后重算分桶');
    }
  });
  
  const newData = loadJSON();
  const anomalyCount = (newData.negative_samples || []).filter(s => 
    s.report_id === reportId && s.is_bucket_diff_anomaly === 1
  ).length;
  
  res.json({ recalculated: samples.length, anomaly_count: anomalyCount });
});

app.post('/api/reports/:id/self-check', (req, res) => {
  const reportId = parseInt(req.params.id);
  const results = selfCheck.runAllChecks(reportId);
  res.json(results);
});

app.get('/api/reports/:id/self-check/latest', (req, res) => {
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  const checks = (data.self_check_results || [])
    .filter(r => r.report_id === reportId)
    .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
  
  const grouped = {};
  checks.forEach(r => {
    if (!grouped[r.check_type]) grouped[r.check_type] = r;
  });
  
  res.json(grouped);
});

app.get('/api/reports/:id/export', (req, res) => {
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  
  const samples = (data.negative_samples || [])
    .filter(s => s.report_id === reportId)
    .sort((a, b) => a.original_line_no - b.original_line_no);

  const contentHash = crypto
    .createHash('md5')
    .update(JSON.stringify(samples))
    .digest('hex');

  db.prepare(`
    INSERT INTO export_records (report_id, export_type, content_hash, exported_by)
    VALUES (?, 'csv', ?, ?)
  `).run(reportId, contentHash, req.query.exported_by || 'system');

  const json2csvParser = new Parser({
    fields: [
      '原始行号', '物料ID', '物料标题', '离线分数', '线上分数',
      '离线分桶', '线上分桶', '分桶差值', '分差一桶异常',
      '人工备注', '处理状态', '已关联召回候选'
    ]
  });

  const csvData = samples.map(s => ({
    '原始行号': s.original_line_no,
    '物料ID': s.item_id,
    '物料标题': s.item_title,
    '离线分数': s.offline_score,
    '线上分数': s.online_score,
    '离线分桶': s.offline_bucket,
    '线上分桶': s.online_bucket,
    '分桶差值': s.bucket_diff,
    '分差一桶异常': s.is_bucket_diff_anomaly ? '是' : '否',
    '人工备注': s.manual_remark || '',
    '处理状态': s.processing_status,
    '已关联召回候选': s.recall_candidate_added ? '是' : '否'
  }));

  const csv = json2csvParser.parse(csvData);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="weekly_report_${reportId}.csv"`);
  res.send('\uFEFF' + csv);
});

app.patch('/api/reports/:id/status', (req, res) => {
  const reportId = parseInt(req.params.id);
  const { status } = req.body;
  
  db.prepare(`
    UPDATE weekly_reports 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(status, reportId);
  
  res.json({ id: reportId, status });
});

app.get('/api/reports/:id/summary', (req, res) => {
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  const samples = (data.negative_samples || []).filter(s => s.report_id === reportId);
  
  const total = samples.length;
  const anomalies = samples.filter(s => s.is_bucket_diff_anomaly === 1).length;
  const pending = samples.filter(s => ['pending', 'imported'].includes(s.processing_status)).length;
  const reviewed = samples.filter(s => s.processing_status === 'reviewed').length;
  const withRecall = samples.filter(s => s.recall_candidate_added === 1).length;
  const recallCount = (data.recall_candidates || []).filter(r => r.report_id === reportId).length;

  res.json({
    total_samples: total,
    bucket_anomalies: anomalies,
    pending_review: pending,
    reviewed: reviewed,
    samples_with_recall: withRecall,
    recall_candidates: recallCount
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`推荐探索率周报系统已启动: http://localhost:${PORT}`);
});
