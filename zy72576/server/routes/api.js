const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const workflow = require('../services/workflow');
const unifiedData = require('../services/unifiedData');
const selfCheck = require('../services/selfCheck');
const store = require('../models/store');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/runs', async (req, res) => {
  try {
    const { name } = req.body;
    const run = await workflow.createRun(name);
    res.json({ success: true, data: run });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/runs', (req, res) => {
  const runs = store.getCalibrationRuns();
  res.json({ success: true, data: runs });
});

router.get('/runs/:runId', (req, res) => {
  const run = store.getCalibrationRun(req.params.runId);
  if (!run) return res.status(404).json({ success: false, error: '任务不存在' });
  res.json({ success: true, data: run });
});

router.get('/runs/:runId/workflow', async (req, res) => {
  try {
    const state = await workflow.getWorkflowState(req.params.runId);
    res.json({ success: true, data: state });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/runs/:runId/advance-step', async (req, res) => {
  try {
    const result = await workflow.advanceStep(req.params.runId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/runs/:runId/import', upload.single('file'), async (req, res) => {
  try {
    const runId = req.params.runId;
    let samples = [];

    if (req.file) {
      samples = await this._parseCsv(req.file.buffer);
    } else if (req.body.samples) {
      samples = Array.isArray(req.body.samples) ? req.body.samples : JSON.parse(req.body.samples);
    } else {
      return res.status(400).json({ success: false, error: '请上传CSV文件或提供samples数据' });
    }

    const result = await workflow.importNegativeSamples(runId, samples);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/runs/:runId/samples', (req, res) => {
  const runId = req.params.runId;
  const options = {
    offset: req.query.offset ? Number(req.query.offset) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder,
    filter: {
      status: req.query.status,
      hasMissingFeatures: req.query.hasMissingFeatures !== undefined ? req.query.hasMissingFeatures === 'true' : undefined,
      usedDefaultScore: req.query.usedDefaultScore !== undefined ? req.query.usedDefaultScore === 'true' : undefined,
      search: req.query.search
    }
  };
  const result = unifiedData.getApiResponse(runId, options);
  res.json({ success: true, data: result });
});

router.get('/samples/:sampleId', (req, res) => {
  const sample = unifiedData.getSampleDetail(req.params.sampleId);
  if (!sample) return res.status(404).json({ success: false, error: '样本不存在' });
  res.json({ success: true, data: sample });
});

router.post('/samples/:sampleId/review-recall', async (req, res) => {
  try {
    const { runId, recallCandidates } = req.body;
    const result = await workflow.reviewRecallCandidates(runId, req.params.sampleId, { recallCandidates });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/samples/:sampleId/update-summary', async (req, res) => {
  try {
    const { runId, summary } = req.body;
    const result = await workflow.updateExplainableSummary(runId, req.params.sampleId, summary);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/samples/:sampleId/mark-normal', async (req, res) => {
  try {
    const { runId, operator } = req.body;
    const result = await workflow.markNormal(runId, req.params.sampleId, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/samples/:sampleId/mark-abnormal', async (req, res) => {
  try {
    const { runId, reason, operator } = req.body;
    const result = await workflow.markAbnormal(runId, req.params.sampleId, reason, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/samples/:sampleId/recompute', async (req, res) => {
  try {
    const { runId, newValues, operator } = req.body;
    const result = await workflow.recomputeSample(runId, req.params.sampleId, newValues, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/runs/:runId/export', (req, res) => {
  const format = req.query.format || 'csv';
  const data = unifiedData.getExportData(req.params.runId, format);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calibration-review-${req.params.runId}.csv"`);
    res.send('\ufeff' + data);
  } else {
    res.json({ success: true, data });
  }
});

router.get('/runs/:runId/self-check', (req, res) => {
  const results = selfCheck.runAllChecks(req.params.runId);
  res.json({ success: true, data: results });
});

router.get('/runs/:runId/self-check/latest', (req, res) => {
  const results = selfCheck.getLatestResults(req.params.runId);
  res.json({ success: true, data: results });
});

router.get('/runs/:runId/consistency', (req, res) => {
  const result = unifiedData.verifyConsistency(req.params.runId);
  res.json({ success: true, data: result });
});

router.get('/summary', (req, res) => {
  const summary = store.getSummary();
  res.json({ success: true, data: summary });
});

router.delete('/runs/:runId', (req, res) => {
  store.clearByRunId(req.params.runId);
  res.json({ success: true });
});

router._parseCsv = function(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString('utf8'));
    stream.pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

module.exports = router;
