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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const loadJSON = dbModule.loadDB;
const saveDB = dbModule.saveDB;
const insertRow = dbModule.insertRow;
const updateRow = dbModule.updateRow;
const now = dbModule.now;

function addAuditLog(sampleId, action, oldValue, newValue, operator, remark) {
  const oper = operator || 'system';
  const rmk = remark || '';
  insertRow(
    'sample_audit_logs',
    ['sample_id', 'action', 'old_value', 'new_value', 'operator', 'remark'],
    [sampleId, action, oldValue, newValue, oper, rmk]
  );
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
    const result = insertRow(
      'weekly_reports',
      ['week_number', 'title', 'created_by', 'status'],
      [week_number, title, created_by || 'system', 'draft']
    );
    res.json({ id: result.lastInsertRowid, week_number, title });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/reports/:id', (req, res) => {
  const data = loadJSON();
  const report = (data.weekly_reports || []).find(r => r.id === parseInt(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

app.get('/api/reports/:id/samples', (req, res) => {
  const { status, anomaly_only } = req.query;
  const reportId = parseInt(req.params.id);
  const data = loadJSON();
  let samples = (data.negative_samples || []).filter(s => s.report_id === reportId);
  if (status) samples = samples.filter(s => s.processing_status === status);
  if (anomaly_only === '1') samples = samples.filter(s => s.is_bucket_diff_anomaly === 1);
  samples.sort((a, b) => a.original_line_no - b.original_line_no);
  res.json(samples);
});
