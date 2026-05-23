const express = require('express');
const router = express.Router();
const { exportFactsToCSV, exportDirtyRecordsToCSV, generateSecuritySupervisorReport } = require('../services/exportService');

router.get('/facts', async (req, res) => {
  try {
    const options = {
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      has_dirty: req.query.has_dirty === 'true' ? true : (req.query.has_dirty === 'false' ? false : null)
    };
    
    const result = exportFactsToCSV(options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/dirty-records', async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      dirty_type: req.query.dirty_type,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    const result = exportDirtyRecordsToCSV(options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/security-report', async (req, res) => {
  try {
    const result = generateSecuritySupervisorReport();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
