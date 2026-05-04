const express = require('express');
const router = express.Router();
const DrillSession = require('../models/DrillSession');
const ExportService = require('../services/ExportService');

router.get('/:sessionId/report', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const exportService = new ExportService(session.id);
    const report = await exportService.getMarkdownReport();
    
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${session.name}_report.md"`);
    res.send(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:sessionId/audit', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const exportService = new ExportService(session.id);
    const auditPackage = await exportService.getJSONAuditPackage();
    
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${session.name}_audit.json"`);
    res.send(auditPackage);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:sessionId/all', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const exportService = new ExportService(session.id);
    const result = await exportService.exportAll();
    
    res.json({
      success: true,
      data: {
        reportPath: result.reportPath,
        jsonPath: result.jsonPath,
        zipPath: result.zipPath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:sessionId/preview/report', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const exportService = new ExportService(session.id);
    const report = await exportService.getMarkdownReport();
    
    res.json({
      success: true,
      data: {
        content: report,
        sessionName: session.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:sessionId/preview/audit', async (req, res) => {
  try {
    const session = DrillSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Drill session not found'
      });
    }
    
    const exportService = new ExportService(session.id);
    const auditPackage = await exportService.getJSONAuditPackage();
    
    res.json({
      success: true,
      data: JSON.parse(auditPackage)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
