const asyncHandler = require('express-async-handler');
const path = require('path');
const ReportService = require('../services/ReportService');

class ReportController {
  static generate = asyncHandler(async (req, res) => {
    const {
      format = 'json',
      createdBy = 'system',
      ...filters
    } = req.body;

    const validFormats = ['json', 'excel', 'markdown', 'pdf'];
    
    if (!validFormats.includes(format)) {
      res.status(400);
      throw new Error(`Invalid format. Use one of: ${validFormats.join(', ')}`);
    }

    const result = await ReportService.generateReport(filters, format, createdBy);

    if (format === 'json') {
      res.json({
        success: true,
        data: result
      });
    } else {
      const fileName = path.basename(result.filePath);
      
      const contentTypeMap = {
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        markdown: 'text/markdown',
        pdf: 'application/pdf'
      };

      const extensionMap = {
        excel: 'xlsx',
        markdown: 'md',
        pdf: 'pdf'
      };

      res.setHeader('Content-Type', contentTypeMap[format]);
      res.setHeader('Content-Disposition', 
        `attachment; filename=report-${result.report.reportId}.${extensionMap[format]}`);
      
      res.download(result.filePath);
    }
  });

  static list = asyncHandler(async (req, res) => {
    const { createdBy, limit = 50 } = req.query;
    
    const reports = await ReportService.listReports(createdBy, parseInt(limit));
    
    res.json({
      success: true,
      data: reports
    });
  });

  static getById = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    
    const report = await ReportService.getReport(reportId);
    
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }
    
    res.json({
      success: true,
      data: report
    });
  });

  static exportExisting = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { format = 'json' } = req.body;
    
    const report = await ReportService.getReport(reportId);
    
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    const DataAccess = require('../data/DataAccess');
    const logs = await DataAccess.findLogs(report.filters || {}, { 
      sort: { timestamp: -1 },
      limit: 10000
    });

    let result;
    switch (format) {
      case 'excel':
        result = await ReportService.exportToExcel(report, logs);
        break;
      case 'markdown':
        result = await ReportService.exportToMarkdown(report, logs);
        break;
      case 'pdf':
        result = await ReportService.exportToPDF(report, logs);
        break;
      default:
        res.json({
          success: true,
          data: report
        });
        return;
    }

    const contentTypeMap = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      markdown: 'text/markdown',
      pdf: 'application/pdf'
    };

    const extensionMap = {
      excel: 'xlsx',
      markdown: 'md',
      pdf: 'pdf'
    };

    res.setHeader('Content-Type', contentTypeMap[format]);
    res.setHeader('Content-Disposition', 
      `attachment; filename=report-${reportId}.${extensionMap[format]}`);
    
    res.download(result.filePath);
  });

  static getPreview = asyncHandler(async (req, res) => {
    const filters = req.body;
    
    const logs = await ReportService.queryLogs(filters);
    const statistics = await ReportService.analyzeLogs(logs);
    
    res.json({
      success: true,
      data: {
        summary: {
          totalLogs: statistics.totalLogs,
          errorCount: statistics.errorCount,
          warningCount: statistics.warningCount,
          anomalyCount: statistics.anomalyCount,
          topServices: statistics.topServices,
          timeRange: statistics.timeRange
        },
        anomalies: statistics.anomalies
      }
    });
  });
}

module.exports = ReportController;
