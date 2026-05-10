const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { getDatabase } = require('../config/database');

const db = getDatabase();

router.get('/stats', (req, res) => {
  try {
    const stats = dashboardService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/blockages', (req, res) => {
  try {
    const blockages = dashboardService.getCurrentBlockages();
    res.json({ 
      success: true, 
      data: blockages,
      count: blockages.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/suggestions', (req, res) => {
  try {
    const suggestions = dashboardService.getTreatmentSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = dashboardService.getRecentHistory(limit);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/flow-status', (req, res) => {
  try {
    const status = dashboardService.getBusinessFlowStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/materials/:id/trend', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const trend = dashboardService.getMaterialTrend(req.params.id, days);
    res.json({ success: true, data: trend });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const module = req.query.module;
    
    let sql = `SELECT * FROM operation_logs WHERE 1=1`;
    const params = [];
    
    if (module) {
      sql += ' AND module = ?';
      params.push(module);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/overview', (req, res) => {
  try {
    const stats = dashboardService.getDashboardStats();
    const blockages = dashboardService.getCurrentBlockages();
    const suggestions = dashboardService.getTreatmentSuggestions();
    const history = dashboardService.getRecentHistory(15);
    const flowStatus = dashboardService.getBusinessFlowStatus();
    
    res.json({
      success: true,
      data: {
        stats,
        blockages,
        suggestions,
        history,
        flow_status: flowStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
