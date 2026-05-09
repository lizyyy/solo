const { param, query, validationResult } = require('express-validator');
const AuditService = require('../services/auditService');

class AuditController {
  static validationRules = {
    getByEntity: [
      param('entityType').isString().isLength({ min: 1 }).withMessage('Entity type is required'),
      param('entityId').isUUID().withMessage('Invalid entity ID')
    ],
    list: [
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
    ]
  };

  static async getByEntity(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { entityType, entityId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const result = await AuditService.getLogsByEntity(entityType, entityId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      logs: result.rows,
      count: result.count
    });
  }

  static async list(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { limit = 100, offset = 0, operatorId, action, startDate, endDate } = req.query;

    const result = await AuditService.getAllLogs({
      limit: parseInt(limit),
      offset: parseInt(offset),
      operatorId,
      action,
      startDate,
      endDate
    });

    return res.status(200).json({
      success: true,
      logs: result.rows,
      count: result.count
    });
  }
}

module.exports = AuditController;