const reportService = require('../services/reportService');
const { getAllHistory } = require('../utils/history');

async function getFinancialReport(req, res, next) {
  try {
    const { projectId, startDate, endDate } = req.query;
    const report = reportService.getFinancialReport({ projectId, startDate, endDate });
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function getProjectReport(req, res, next) {
  try {
    const { projectId } = req.params;
    const report = reportService.getProjectReport(projectId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function getFullReconciliationReport(req, res, next) {
  try {
    const report = reportService.getFullReconciliationReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function exportReport(req, res, next) {
  try {
    const { format = 'json' } = req.query;
    const exported = reportService.exportReport(format);
    
    res.setHeader('Content-Type', exported.contentType);
    if (format === 'text') {
      res.setHeader('Content-Disposition', 'attachment; filename=reconciliation-report.txt');
    }
    
    res.send(exported.content);
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const { limit = 100 } = req.query;
    const history = getAllHistory(parseInt(limit));
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    next(error);
  }
}

async function getStatusSummary(req, res, next) {
  try {
    const report = reportService.getFullReconciliationReport();
    
    const summary = {
      timestamp: report.reportDate,
      overview: report.summary,
      financial: report.financial,
      reconciliationStatus: report.reconciliationChecks.map(c => ({
        check: c.name,
        status: c.status,
        difference: c.difference
      })),
      projects: report.projects.map(p => ({
        projectId: p.project.id,
        projectName: p.project.name,
        totalDonated: p.fundSummary.totalDonated,
        totalUsed: p.fundSummary.totalUsed,
        availableBalance: p.fundSummary.availableBalance,
        invoiceCount: p.invoices.total.count
      }))
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getFinancialReport,
  getProjectReport,
  getFullReconciliationReport,
  exportReport,
  getHistory,
  getStatusSummary
};
