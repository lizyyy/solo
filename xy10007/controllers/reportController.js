const { query, validationResult } = require('express-validator');
const ReportService = require('../services/reportService');

class ReportController {
  static validationRules = {
    exportRefunds: [
      query('startDate').optional().isISO8601().withMessage('Invalid start date'),
      query('endDate').optional().isISO8601().withMessage('Invalid end date')
    ],
    exportAudit: [
      query('startDate').optional().isISO8601().withMessage('Invalid start date'),
      query('endDate').optional().isISO8601().withMessage('Invalid end date')
    ],
    statistics: [
      query('startDate').optional().isISO8601().withMessage('Invalid start date'),
      query('endDate').optional().isISO8601().withMessage('Invalid end date')
    ]
  };

  static async exportRefunds(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      const { startDate, endDate, status } = req.query;
      
      const refunds = await ReportService.generateRefundReport({
        startDate,
        endDate,
        status
      });

      const buffer = await ReportService.exportToExcel(refunds);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=refunds_${Date.now()}.xlsx`);
      
      return res.send(buffer);
    } catch (error) {
      console.error('Export refunds error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export refunds'
      });
    }
  }

  static async exportAudit(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      const { startDate, endDate, entityType, operatorId, action } = req.query;
      
      const logs = await ReportService.generateAuditReport({
        startDate,
        endDate,
        entityType,
        operatorId,
        action
      });

      const buffer = await ReportService.exportAuditToExcel(logs);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${Date.now()}.xlsx`);
      
      return res.send(buffer);
    } catch (error) {
      console.error('Export audit logs error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export audit logs'
      });
    }
  }

  static async getStatistics(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      const { startDate, endDate } = req.query;
      
      const stats = await ReportService.getStatistics({
        startDate,
        endDate
      });

      return res.status(200).json({
        success: true,
        statistics: stats
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get statistics'
      });
    }
  }
}

module.exports = ReportController;