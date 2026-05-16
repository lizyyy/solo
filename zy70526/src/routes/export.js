const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const ArbitrationSummary = require('../models/ArbitrationSummary');
const RiskSample = require('../models/RiskSample');
const ReprocessTask = require('../models/ReprocessTask');

router.get('/summary/:id', async (req, res) => {
  try {
    const summary = await ArbitrationSummary.findById(req.params.id);
    if (!summary) {
      return res.status(404).json({
        error: '仲裁摘要不存在',
        code: 'SUMMARY_NOT_FOUND'
      });
    }

    const samples = await RiskSample.findByDatasetId(summary.dataset_id);
    const tasks = await ReprocessTask.findByDatasetId(summary.dataset_id);

    const reportData = {
      summary: summary,
      risk_samples: samples,
      reprocess_tasks: tasks,
      export_time: new Date().toISOString()
    };

    if (req.query.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="summary-${req.params.id}.json"`);
      res.json(reportData);
    } else {
      const csvFields = [
        'id', 'dataset_id', 'total_samples', 'high_risk_count',
        'medium_risk_count', 'low_risk_count', 'approved_count',
        'rejected_count', 'need_reprocess_count', 'summary', 'created_at'
      ];
      const json2csvParser = new Parser({ fields: csvFields });
      const csv = json2csvParser.parse([summary]);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="summary-${req.params.id}.csv"`);
      res.send(csv);
    }

    await ArbitrationSummary.markExported(req.params.id);
  } catch (err) {
    res.status(500).json({
      error: '导出失败',
      code: 'EXPORT_ERROR',
      message: err.message
    });
  }
});

router.get('/risk-samples/:datasetId', async (req, res) => {
  try {
    const samples = await RiskSample.findByDatasetId(req.params.datasetId);
    
    const flatSamples = samples.map(s => ({
      ...s,
      identified_fields: JSON.stringify(s.identified_fields)
    }));

    const csvFields = [
      'id', 'dataset_id', 'risk_level', 'risk_type',
      'confidence_score', 'status', 'identified_fields', 'created_at'
    ];
    const json2csvParser = new Parser({ fields: csvFields });
    const csv = json2csvParser.parse(flatSamples);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="risk-samples-${req.params.datasetId}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({
      error: '导出风险样本失败',
      code: 'EXPORT_SAMPLES_ERROR',
      message: err.message
    });
  }
});

router.get('/reprocess-tasks/:datasetId', async (req, res) => {
  try {
    const tasks = await ReprocessTask.findByDatasetId(req.params.datasetId);
    
    const flatTasks = tasks.map(t => ({
      ...t,
      original_input: JSON.stringify(t.original_input),
      processing_basis: JSON.stringify(t.processing_basis),
      final_conclusion: JSON.stringify(t.final_conclusion)
    }));

    const csvFields = [
      'id', 'dataset_id', 'rule_id', 'status', 'priority',
      'error_message', 'created_at', 'updated_at'
    ];
    const json2csvParser = new Parser({ fields: csvFields });
    const csv = json2csvParser.parse(flatTasks);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reprocess-tasks-${req.params.datasetId}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({
      error: '导出重处理任务失败',
      code: 'EXPORT_TASKS_ERROR',
      message: err.message
    });
  }
});

module.exports = router;