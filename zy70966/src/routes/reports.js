const express = require('express');
const fs = require('fs');
const { buildSummary, listDetails, exportCsv } = require('../services/reportService');
const { traceFromDetail, traceFromReport } = require('../services/traceService');
const { jsonOk, jsonErr } = require('../utils/response');
const db = require('../db');

const router = express.Router();

router.get('/summary', (req, res) => {
  try {
    const r = buildSummary(req.query);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/details', (req, res) => {
  try {
    const r = listDetails(req.query);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/export', (req, res) => {
  try {
    const r = exportCsv(req.body || {});
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/download/:reportId', (req, res) => {
  try {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(Number(req.params.reportId));
    if (!r || !r.file_path || !fs.existsSync(r.file_path)) return jsonErr(res, 'not found', 404);
    res.download(r.file_path);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/reports', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all();
    jsonOk(res, rows);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/trace/qa-item/:id', (req, res) => {
  try {
    const r = traceFromDetail(Number(req.params.id));
    if (!r) return jsonErr(res, 'not found', 404);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/trace/report/:id', (req, res) => {
  try {
    const r = traceFromReport(Number(req.params.id));
    if (!r) return jsonErr(res, 'not found', 404);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

module.exports = router;
