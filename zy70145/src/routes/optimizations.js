const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:id/reruns', (req, res) => {
  try {
    const optimizationId = parseInt(req.params.id);
    
    const optimization = db.findById('optimization_records', optimizationId);
    if (!optimization) {
      return res.status(404).json({
        success: false,
        error: 'Optimization not found'
      });
    }
    
    const reruns = db.findAll('rerun_results', r => r.optimization_record_id === optimizationId)
      .sort((a, b) => b.created_at - a.created_at);
    
    res.json({
      success: true,
      data: reruns
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

router.post('/:id/reruns', (req, res) => {
  try {
    const optimizationId = parseInt(req.params.id);
    const { before_time, after_time, environment, notes } = req.body;
    
    const slowQueryService = require('../services/slowQueryService');
    
    const result = slowQueryService.recordRerun(
      optimizationId,
      { before_time, after_time, environment, notes }
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    if (e.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: e.message
      });
    }
    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

module.exports = router;
