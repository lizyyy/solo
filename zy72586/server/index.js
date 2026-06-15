const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Parser } = require('json2csv');
const dbModule = require('./db');
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

const db = dbModule;
const loadJSON = dbModule.loadDB;
const saveDB = dbModule.saveDB;

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

  const snapshot = samples.map(s => ({
    ...s,
    evidence_snapshot: getEvidenceChain(s.id, data)
  }));

  const contentHash = crypto
    .createHash('md5')
    .update(JSON.stringify(samples))
    .digest('hex');

  const insertResult = db.prepare(`
    INSERT INTO export_records (report_id, export_type, content_hash, exported_by)
    VALUES (?, 'csv', ?, ?)
  `).run(reportId, contentHash, req.query.exported_by || 'system');

  const exportId = insertResult.lastInsertRowid;
  const allData = loadJSON();
  if (!allData.export_records) allData.export_records = [];
  const exportRecord = allData.export_records.find(e => e.id === exportId);
  if (exportRecord) {
    exportRecord.snapshot_data = snapshot;
    saveDB(allData);
  }

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

function getEvidenceChain(sampleId, data) {
  const audits = (data.sample_audit_logs || []).filter(a => a.sample_id === sampleId);
  const recalls = (data.recall_candidates || []).filter(r => r.sample_id === sampleId);
  const statusHistory = [];
  
  let lastStatus = null;
  audits.forEach(a => {
    if (a.action === 'update_status') {
      statusHistory.push({
        from: a.old_value,
        to: a.new_value,
        operator: a.operator,
        time: a.created_at,
        remark: a.remark
      });
      lastStatus = a.new_value;
    } else if (a.action === 'import') {
      statusHistory.push({
        from: null,
        to: 'imported',
        operator: a.operator,
        time: a.created_at,
        remark: '首次导入'
      });
      lastStatus = 'imported';
    }
  });

  const manualRemarks = audits
    .filter(a => a.action === 'update_manual_remark')
    .map(a => ({
      old: a.old_value,
      new: a.new_value,
      operator: a.operator,
      time: a.created_at,
      remark: a.remark
    }));

  const recallLinks = audits
    .filter(a => a.action === 'link_recall')
    .map(a => ({
      data: a.new_value,
      operator: a.operator,
      time: a.created_at,
      remark: a.remark
    }));

  const recalcLogs = audits
    .filter(a => a.action === 'recalc_bucket')
    .map(a => ({
      old_anomaly: a.old_value,
      new_anomaly: a.new_value,
      operator: a.operator,
      time: a.created_at,
      remark: a.remark
    }));

  return {
    audit_count: audits.length,
    status_history: statusHistory,
    current_status: lastStatus,
    manual_remark_history: manualRemarks,
    recall_link_history: recallLinks,
    recalc_history: recalcLogs,
    recalls: recalls,
    audits: audits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  };
}

app.get('/api/reports/:id/export-history', (req, res) => {
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  const exports = (data.export_records || [])
    .filter(e => e.report_id === reportId)
    .sort((a, b) => new Date(b.exported_at) - new Date(a.exported_at));
  
  exports.forEach(e => {
    if (e.snapshot_data) {
      e.sample_count = e.snapshot_data.length;
      e.anomaly_count = e.snapshot_data.filter(s => s.is_bucket_diff_anomaly === 1).length;
    }
  });
  
  res.json(exports);
});

app.get('/api/exports/:id', (req, res) => {
  const exportId = parseInt(req.params.id);
  const data = loadJSON();
  const exp = (data.export_records || []).find(e => e.id === exportId);
  
  if (!exp) return res.status(404).json({ error: 'Export not found' });
  
  const exports = (data.export_records || []).filter(e => e.report_id === exp.report_id);
  const prevExport = exports
    .filter(e => e.id < exportId)
    .sort((a, b) => b.id - a.id)[0];
  
  const samples = exp.snapshot_data || [];
  const report = (data.weekly_reports || []).find(r => r.id === exp.report_id);
  
  const samplesWithEvidence = samples.map(s => ({
    ...s,
    evidence: getEvidenceChain(s.id, data)
  }));
  
  let diff = null;
  if (prevExport && prevExport.snapshot_data) {
    const prevMap = new Map(prevExport.snapshot_data.map(s => [s.item_id, s]));
    const currMap = new Map(samples.map(s => [s.item_id, s]));
    const changes = [];
    
    samples.forEach(curr => {
      const prev = prevMap.get(curr.item_id);
      if (prev) {
        const itemChanges = [];
        ['processing_status', 'manual_remark', 'is_bucket_diff_anomaly', 
         'recall_candidate_added', 'offline_bucket', 'online_bucket'].forEach(field => {
          if (JSON.stringify(prev[field]) !== JSON.stringify(curr[field])) {
            itemChanges.push({
              field,
              from: prev[field],
              to: curr[field]
            });
          }
        });
        if (itemChanges.length > 0) {
          changes.push({
            item_id: curr.item_id,
            item_title: curr.item_title,
            changes: itemChanges
          });
        }
      }
    });
    
    const added = samples.filter(s => !prevMap.has(s.item_id));
    const removed = prevExport.snapshot_data.filter(s => !currMap.has(s.item_id));
    
    diff = {
      prev_export_id: prevExport.id,
      prev_exported_at: prevExport.exported_at,
      changes,
      added,
      removed
    };
  }
  
  res.json({
    export: exp,
    report,
    samples: samplesWithEvidence,
    diff,
    anomaly_summary: samples.filter(s => s.is_bucket_diff_anomaly === 1).map(s => ({
      id: s.id,
      item_id: s.item_id,
      item_title: s.item_title,
      original_line_no: s.original_line_no,
      offline_score: s.offline_score,
      online_score: s.online_score,
      offline_bucket: s.offline_bucket,
      online_bucket: s.online_bucket,
      processing_status: s.processing_status,
      manual_remark: s.manual_remark
    }))
  });
});

app.get('/api/samples/:id/evidence', (req, res) => {
  const sampleId = parseInt(req.params.id);
  const data = loadJSON();
  const sample = (data.negative_samples || []).find(s => s.id === sampleId);
  
  if (!sample) return res.status(404).json({ error: 'Sample not found' });
  
  const evidence = getEvidenceChain(sampleId, data);
  
  res.json({
    sample,
    evidence
  });
});

app.patch('/api/reports/:id/samples/status', (req, res) => {
  const reportId = parseInt(req.params.id);
  const { sample_ids, processing_status, operator, remark } = req.body;
  
  if (!sample_ids || !processing_status) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  
  const data = loadJSON();
  
  sample_ids.forEach(sid => {
    const sample = (data.negative_samples || []).find(s => s.id === sid && s.report_id === reportId);
    if (sample) {
      const oldStatus = sample.processing_status;
      sample.processing_status = processing_status;
      sample.updated_at = now();
      
      db.prepare(`
        INSERT INTO sample_audit_logs (sample_id, action, old_value, new_value, operator, remark)
        VALUES (?, 'update_status', ?, ?, ?, ?)
      `).run(sid, oldStatus, processing_status, operator || 'system', remark || '批量更新状态');
    }
  });
  
  saveDB(data);
  res.json({ updated: sample_ids.length, status: processing_status });
});

app.get('/api/exports/:id/csv', (req, res) => {
  const exportId = parseInt(req.params.id);
  const data = loadJSON();
  const exp = (data.export_records || []).find(e => e.id === exportId);
  
  if (!exp) return res.status(404).json({ error: 'Export not found' });
  if (!exp.snapshot_data) return res.status(400).json({ error: 'No snapshot data' });
  
  const samples = exp.snapshot_data;
  
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
  res.setHeader('Content-Disposition', `attachment; filename="weekly_report_export_${exportId}_snapshot.csv"`);
  res.send('\uFEFF' + csv);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`推荐探索率周报系统已启动: http://localhost:${PORT}`);
});
