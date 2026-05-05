const express = require('express');
const router = express.Router();
const experimentManager = require('../models/ExperimentManager');

router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const results = await experimentManager.runExperiment(id);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/results', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const details = experiment.getFullDetails();
    
    if (!details.simulationResults) {
      return res.status(404).json({
        success: false,
        error: 'Simulation results not found. Please run the experiment first.'
      });
    }
    
    res.json({
      success: true,
      data: details.simulationResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const stats = experiment.cacheSystem.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/risks', (req, res) => {
  try {
    const { id } = req.params;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const risks = {
      consistency: experiment.cacheSystem.getConsistencyRisk(),
      penetration: experiment.cacheSystem.getPenetrationRisk(),
      breakdown: experiment.cacheSystem.getBreakdownRisk(),
      avalanche: experiment.cacheSystem.getAvalancheRisk()
    };
    
    res.json({
      success: true,
      data: risks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/events', (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit } = req.query;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    const options = {};
    if (type) options.type = type;
    if (limit) options.limit = parseInt(limit);
    
    const events = experiment.cacheSystem.getEvents(options);
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/traffic', (req, res) => {
  try {
    const { id } = req.params;
    const { trafficPlan } = req.body;
    const experiment = experimentManager.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found'
      });
    }
    
    if (!trafficPlan || !Array.isArray(trafficPlan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid traffic plan. Expected an array of steps.'
      });
    }
    
    experiment.setTrafficPlan(trafficPlan);
    
    res.json({
      success: true,
      data: {
        message: 'Traffic plan updated successfully',
        stepCount: trafficPlan.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
