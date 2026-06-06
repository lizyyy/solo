const express = require('express');
const router = express.Router();
const SampleDataService = require('../services/sampleDataService');

router.get('/scenarios', (req, res) => {
  try {
    const scenarios = SampleDataService.getSampleScenarios();
    res.json(scenarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/load', (req, res) => {
  try {
    const result = SampleDataService.loadSampleData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo', (req, res) => {
  try {
    SampleDataService.loadSampleData();
    const result = SampleDataService.runDemoFlow();
    res.json({
      records: result.records,
      report: result.report
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
