const AuditService = require('../services/AuditService');

class AuditController {
  static async getRequestAuditLog(req, res) {
    try {
      const { request_id } = req.params;
      const result = await AuditService.getRequestAuditLog(request_id);

      if (!result.request) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '请求单不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取审计日志错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async exportToMarkdown(req, res) {
    try {
      const { request_id } = req.params;
      const markdown = await AuditService.exportToMarkdown(request_id);

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="request-${request_id}.md"`);
      res.send(markdown);
    } catch (error) {
      console.error('导出Markdown错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async exportDailyReport(req, res) {
    try {
      const { date } = req.query;
      const markdown = await AuditService.exportAllToMarkdown(date);

      const reportDate = date || new Date().toISOString().split('T')[0];
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="daily-report-${reportDate}.md"`);
      res.send(markdown);
    } catch (error) {
      console.error('导出日报错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = AuditController;
