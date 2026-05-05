const store = require('../store');
const reportService = require('../services/reportService');

class ReportController {
  generateJSONReport(req, res) {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'taskId is required'
        });
      }

      const report = reportService.generateJSONReport(taskId);
      res.json({
        success: true,
        message: 'JSON report generated successfully',
        data: report.toJSON()
      });
    } catch (error) {
      if (error.message.includes('Task not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  generateMarkdownReport(req, res) {
    try {
      const { taskId } = req.body;
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'taskId is required'
        });
      }

      const report = reportService.generateMarkdownReport(taskId);
      res.json({
        success: true,
        message: 'Markdown report generated successfully',
        data: report.toJSON()
      });
    } catch (error) {
      if (error.message.includes('Task not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getReport(req, res) {
    try {
      const { id } = req.params;
      const report = store.getReport(id);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      res.json({
        success: true,
        data: report.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getAllReports(req, res) {
    try {
      const { taskId } = req.query;
      let reports;

      if (taskId) {
        reports = store.getReportsByTaskId(taskId);
      } else {
        reports = store.getAllReports();
      }

      res.json({
        success: true,
        count: reports.length,
        data: reports.map(r => r.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  exportReport(req, res) {
    try {
      const { id } = req.params;
      const exported = reportService.exportReport(id);

      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.setHeader('Content-Type', exported.format === 'markdown' ? 'text/markdown' : 'application/json');
      res.send(exported.content);
    } catch (error) {
      if (error.message.includes('Report not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ReportController();
