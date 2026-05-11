const express = require('express');
const DamageService = require('../services/damageService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      storeId: req.query.storeId,
      status: req.query.status,
      damageType: req.query.damageType
    };
    
    const reports = await DamageService.getDamageReports(filters);
    
    res.status(200).json({
      reports,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting damage reports:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:reportId', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await DamageService.getDamageReportById(reportId);
    
    if (!report) {
      return res.status(404).json({
        error: 'Damage report not found',
        requestId: req.requestId
      });
    }
    
    const items = await DamageService.getDamageReportItems(reportId);
    
    res.status(200).json({
      report,
      items,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting damage report:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const reportData = req.body;
    
    const newReport = await DamageService.createDamageReport(
      reportData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      report: newReport,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating damage report:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:reportId/submit', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const updatedReport = await DamageService.submitDamageReport(
      reportId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      report: updatedReport,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error submitting damage report:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:reportId/approve', authMiddleware, async (req, res) => {
  try {
    const { reportId } = req.params;
    const approveData = req.body;
    
    const updatedReport = await DamageService.approveDamageReport(
      reportId,
      approveData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      report: updatedReport,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error approving damage report:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
