const exportService = require('../services/ExportService');
const dayjs = require('dayjs');

class ExportController {
  async exportToMarkdown(req, res) {
    try {
      const { trading_day_id } = req.params;
      const { include_history = true, history_days = 30 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const markdown = await exportService.exportToMarkdown(trading_day_id, {
        includeHistory: include_history === 'true',
        historyDays: parseInt(history_days)
      });

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trading-report-${dayjs().format('YYYYMMDD')}.md"`);
      
      res.send(markdown);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async exportToHTML(req, res) {
    try {
      const { trading_day_id } = req.params;
      const { include_history = true, history_days = 30 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const html = await exportService.exportToHTML(trading_day_id, {
        includeHistory: include_history === 'true',
        historyDays: parseInt(history_days)
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trading-report-${dayjs().format('YYYYMMDD')}.html"`);
      
      res.send(html);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async exportToCSV(req, res) {
    try {
      const { trading_day_id } = req.params;
      const { include_history = true, history_days = 30 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const csv = await exportService.exportToCSV(trading_day_id, {
        includeHistory: include_history === 'true',
        historyDays: parseInt(history_days)
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="trading-report-${dayjs().format('YYYYMMDD')}.csv"`);
      
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getReportPreview(req, res) {
    try {
      const { trading_day_id } = req.params;
      const { include_history = true, history_days = 30 } = req.query;

      if (!trading_day_id) {
        return res.status(400).json({
          success: false,
          message: '交易日期不能为空'
        });
      }

      const data = await exportService.generateReportData(trading_day_id, {
        includeHistory: include_history === 'true',
        historyDays: parseInt(history_days)
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ExportController();
