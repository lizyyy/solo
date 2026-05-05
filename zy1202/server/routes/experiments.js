const express = require('express');
const router = express.Router();
const experimentManager = require('../models/ExperimentManager');

router.get('/', (req, res) => {
  try {
    const experiments = experimentManager.getAllExperiments();
    res.json({
      success: true,
      data: experiments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const config = req.body;
    const experiment = experimentManager.createExperiment(config);
    res.json({
      success: true,
      data: experiment.getSummary()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    res.json({
      success: true,
      data: experiment.getFullDetails()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = experimentManager.updateExperiment(id, updates);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = experimentManager.deleteExperiment(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    res.json({
      success: true,
      data: { message: 'Experiment deleted successfully' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/reset', (req, res) => {
  try {
    const { id } = req.params;
    const reset = experimentManager.resetExperiment(id);
    
    if (!reset) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    res.json({
      success: true,
      data: reset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
