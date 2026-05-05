const express = require('express');
const multer = require('multer');
const BenchmarkParser = require('../services/parser');
const Storage = require('../services/storage');
const Comparator = require('../services/comparator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    let content = '';
    let format = req.body.format || 'auto';
    
    if (req.file) {
      content = req.file.buffer.toString('utf-8');
    } else if (req.body.content) {
      content = req.body.content;
    } else {
      return res.status(400).json({
        error: 'No file or content provided'
      });
    }
    
    const run_id = req.body.run_id || `run-${Date.now()}`;
    const version = req.body.version;
    const pkg = req.body.package;
    const notes = req.body.notes;
    const pprof_summary = req.body.pprof_summary ? JSON.parse(req.body.pprof_summary) : null;
    
    let parsed;
    if (format === 'json') {
      parsed = BenchmarkParser.parseJson(content);
    } else if (format === 'text') {
      parsed = BenchmarkParser.parseText(content);
    } else {
      parsed = BenchmarkParser.autoParse(content);
    }
    
    const packageName = pkg || parsed.package || 'unknown';
    
    const runDbId = await Storage.saveBenchmarkRun({
      run_id,
      version,
      package: packageName,
      notes,
      pprof_summary
    });
    
    if (parsed.benchmarks && parsed.benchmarks.length > 0) {
      await Storage.saveBenchmarkResults(runDbId, parsed.benchmarks);
    }
    
    const savedRun = await Storage.getBenchmarkRun(run_id);
    const savedResults = await Storage.getBenchmarkResults(runDbId);
    
    res.status(201).json({
      message: 'Benchmark imported successfully',
      run: savedRun,
      benchmarks: savedResults,
      count: savedResults.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      error: 'Failed to import benchmark',
      details: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.package) {
      filters.package = req.query.package;
    }
    if (req.query.version) {
      filters.version = req.query.version;
    }
    
    const runs = await Storage.listBenchmarkRuns(filters);
    
    res.json({
      runs,
      count: runs.length
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({
      error: 'Failed to list benchmarks',
      details: error.message
    });
  }
});

router.get('/:runId', async (req, res) => {
  try {
    const run = await Storage.getBenchmarkRun(req.params.runId);
    
    if (!run) {
      return res.status(404).json({
        error: 'Benchmark run not found'
      });
    }
    
    const results = await Storage.getBenchmarkResults(run.id);
    const tags = await Storage.getAuditTags(run.id);
    
    res.json({
      run,
      benchmarks: results,
      tags
    });
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({
      error: 'Failed to get benchmark',
      details: error.message
    });
  }
});

router.post('/compare', async (req, res) => {
  try {
    const { base_run_id, new_run_id, threshold, notes, format } = req.body;
    
    if (!base_run_id || !new_run_id) {
      return res.status(400).json({
        error: 'Both base_run_id and new_run_id are required'
      });
    }
    
    const options = {};
    if (threshold !== undefined) {
      options.threshold = parseFloat(threshold);
    }
    
    const comparison = await Comparator.saveComparison(
      base_run_id,
      new_run_id,
      notes || '',
      options
    );
    
    if (format === 'text') {
      const formatted = Comparator.formatComparisonResult(comparison);
      res.set('Content-Type', 'text/plain');
      res.send(formatted);
    } else {
      res.json({
        comparisonId: comparison.comparisonId,
        overallStatus: comparison.overallStatus,
        summary: comparison.summary,
        details: comparison.details,
        baseRun: comparison.baseRun,
        newRun: comparison.newRun
      });
    }
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({
      error: 'Failed to compare benchmarks',
      details: error.message
    });
  }
});

router.get('/compare/:comparisonId', async (req, res) => {
  try {
    const comparison = await Comparator.getComparisonWithDetails(req.params.comparisonId);
    
    if (!comparison) {
      return res.status(404).json({
        error: 'Comparison not found'
      });
    }
    
    if (req.query.format === 'text') {
      const formatted = Comparator.formatComparisonResult(comparison);
      res.set('Content-Type', 'text/plain');
      res.send(formatted);
    } else {
      res.json(comparison);
    }
  } catch (error) {
    console.error('Get comparison error:', error);
    res.status(500).json({
      error: 'Failed to get comparison',
      details: error.message
    });
  }
});

router.get('/comparisons', async (req, res) => {
  try {
    const comparisons = await Storage.listComparisons();
    
    res.json({
      comparisons,
      count: comparisons.length
    });
  } catch (error) {
    console.error('List comparisons error:', error);
    res.status(500).json({
      error: 'Failed to list comparisons',
      details: error.message
    });
  }
});

module.exports = router;
