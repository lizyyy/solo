const express = require('express');
const router = express.Router();
const experimentManager = require('../models/ExperimentManager');
const reportGenerator = require('../models/ReportGenerator');

router.get('/:id/json', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const report = reportGenerator.generateJSON(experiment);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/markdown', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const markdown = reportGenerator.generateMarkdown(experiment);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="experiment-${id}-report.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/preview', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const markdown = reportGenerator.generateMarkdown(experiment);
    
    res.json({
      success: true,
      data: {
        markdown,
        experimentId: id,
        experimentName: experiment.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/download/json', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const report = reportGenerator.generateJSON(experiment);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="experiment-${id}-report.json"`);
    res.send(JSON.stringify(report, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/download/markdown', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const markdown = reportGenerator.generateMarkdown(experiment);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="experiment-${id}-report.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
