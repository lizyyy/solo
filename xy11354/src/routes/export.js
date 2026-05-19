const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const ExportService = require('../services/ExportService');

router.get('/visitors', async (req, res) => {
  try {
    const filters = {
      visitDate: req.query.visitDate,
      status: req.query.status,
      reviewStatus: req.query.reviewStatus
    };
    
    const isAdmin = req.user?.role === 'admin';
    const result = await ExportService.exportVisitors(filters, { isAdmin, includeSensitive: isAdmin });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Export visitors error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/temporary-plates', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      reviewStatus: req.query.reviewStatus
    };
    
    const isAdmin = req.user?.role === 'admin';
    const result = await ExportService.exportTemporaryPlates(filters, { isAdmin, includeSensitive: isAdmin });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Export plates error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/blacklist', async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      status: req.query.status,
      level: req.query.level
    };
    
    const isAdmin = req.user?.role === 'admin';
    const result = await ExportService.exportBlacklist(filters, { isAdmin, includeSensitive: isAdmin });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Export blacklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/verify-records', async (req, res) => {
  try {
    const filters = {
      verifyType: req.query.type,
      isAllowed: req.query.isAllowed !== undefined ? req.query.isAllowed === 'true' : undefined,
      isInBlacklist: req.query.isInBlacklist !== undefined ? req.query.isInBlacklist === 'true' : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const isAdmin = req.user?.role === 'admin';
    const result = await ExportService.exportVerifyRecords(filters, { isAdmin, includeSensitive: isAdmin });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Export verify records error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/files', (req, res) => {
  try {
    const files = ExportService.getExportedFiles();
    res.json({ success: true, data: files });
  } catch (error) {
    logger.error('Get export files error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const exportDir = path.join(__dirname, '../../data/exports');
    const filePath = path.join(exportDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    res.download(filePath, filename);
  } catch (error) {
    logger.error('Download file error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
