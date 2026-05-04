const express = require('express');
const router = express.Router();
const ExportService = require('../services/exportService');

router.get('/handover/markdown', async (req, res) => {
  try {
    const { date, operator, includeResolved } = req.query;
    
    const options = {
      date: date ? new Date(date) : new Date(),
      operator: operator || '值班员',
      includeResolved: includeResolved === 'true'
    };
    
    const result = await ExportService.generateMarkdownHandover(options);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    
    res.send(result.content);
  } catch (error) {
    console.error('Error generating markdown handover:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/handover/preview', async (req, res) => {
  try {
    const { date, operator, includeResolved } = req.query;
    
    const options = {
      date: date ? new Date(date) : new Date(),
      operator: operator || '值班员',
      includeResolved: includeResolved === 'true'
    };
    
    const result = await ExportService.generateMarkdownHandover(options);
    
    res.json({
      success: true,
      data: {
        filename: result.filename,
        content: result.content
      }
    });
  } catch (error) {
    console.error('Error previewing markdown handover:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/audit/json', async (req, res) => {
  try {
    const { startDate, endDate, includeAllData } = req.query;
    
    const options = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      includeAllData: includeAllData === 'true'
    };
    
    const result = await ExportService.generateJsonAuditPackage(options);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    
    res.send(result.content);
  } catch (error) {
    console.error('Error generating JSON audit package:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/audit/preview', async (req, res) => {
  try {
    const { startDate, endDate, includeAllData } = req.query;
    
    const options = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      includeAllData: includeAllData === 'true'
    };
    
    const result = await ExportService.generateJsonAuditPackage(options);
    
    const auditData = JSON.parse(result.content);
    
    res.json({
      success: true,
      data: {
        filename: result.filename,
        metadata: auditData.metadata,
        statistics: auditData.statistics,
        riskCount: auditData.risks?.length || 0,
        sampleCount: auditData.samples?.length || 0
      }
    });
  } catch (error) {
    console.error('Error previewing JSON audit package:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
