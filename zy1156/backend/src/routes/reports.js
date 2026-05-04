const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const ContextPackage = require('../models/ContextPackage');
const TokenStrategy = require('../models/TokenStrategy');
const reportService = require('../services/reportService');

router.post('/generate', async (req, res) => {
  try {
    const { evaluationId, format } = req.body;
    
    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        error: 'evaluationId is required'
      });
    }
    
    const validFormats = ['markdown', 'json'];
    const reportFormat = format || 'markdown';
    if (!validFormats.includes(reportFormat)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Valid formats: ${validFormats.join(', ')}`
      });
    }
    
    const evaluation = Evaluation.findById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }
    
    const contextPackage = ContextPackage.findById(evaluation.contextPackageId);
    const strategy = TokenStrategy.findById(evaluation.strategyId);
    
    let reportContent;
    let mimeType;
    let fileExtension;
    
    if (reportFormat === 'markdown') {
      reportContent = reportService.generateMarkdownReport(
        evaluation, 
        contextPackage, 
        strategy
      );
      mimeType = 'text/markdown';
      fileExtension = 'md';
    } else {
      reportContent = reportService.generateJsonReport(
        evaluation, 
        contextPackage, 
        strategy
      );
      reportContent = JSON.stringify(reportContent, null, 2);
      mimeType = 'application/json';
      fileExtension = 'json';
    }
    
    const savedReport = reportService.saveReport(
      evaluationId,
      reportFormat,
      reportContent
    );
    
    res.json({
      success: true,
      data: {
        reportId: savedReport.id,
        format: reportFormat,
        createdAt: savedReport.createdAt,
        content: reportContent,
        download: {
          filename: `evaluation-report-${evaluationId}.${fileExtension}`,
          mimeType
        }
      }
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = reportService.getReport(id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/evaluation/:evaluationId', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const reports = reportService.getReportsByEvaluationId(evaluationId);
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { evaluation, contextPackage, strategy, format } = req.body;
    
    if (!evaluation) {
      return res.status(400).json({
        success: false,
        error: 'evaluation data is required'
      });
    }
    
    const validFormats = ['markdown', 'json'];
    const reportFormat = format || 'markdown';
    if (!validFormats.includes(reportFormat)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Valid formats: ${validFormats.join(', ')}`
      });
    }
    
    const mockEvaluation = {
      id: evaluation.id || 'preview',
      contextPackageId: evaluation.contextPackageId || 'preview',
      strategyId: evaluation.strategyId || 'preview',
      riskLevel: evaluation.riskLevel || 'low',
      notes: evaluation.notes || '',
      createdAt: evaluation.createdAt || new Date().toISOString(),
      getResult: () => evaluation.result
    };
    
    let reportContent;
    
    if (reportFormat === 'markdown') {
      reportContent = reportService.generateMarkdownReport(
        mockEvaluation, 
        contextPackage, 
        strategy
      );
    } else {
      reportContent = reportService.generateJsonReport(
        mockEvaluation, 
        contextPackage, 
        strategy
      );
    }
    
    res.json({
      success: true,
      data: {
        format: reportFormat,
        content: reportContent
      }
    });
  } catch (error) {
    console.error('Error previewing report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
