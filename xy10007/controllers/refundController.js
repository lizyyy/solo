const { body, param, validationResult, query } = require('express-validator');
const RefundService = require('../services/refundService');
const TaskService = require('../services/taskService');

class RefundController {
  static validationRules = {
    create: [
      body('orderId').isUUID().withMessage('Invalid order ID'),
      body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
      body('reason').isString().isLength({ min: 1, max: 500 }).withMessage('Reason must be between 1 and 500 characters')
    ],
    approve: [
      param('id').isUUID().withMessage('Invalid refund ID'),
      body('comment').optional().isString().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
    ],
    reject: [
      param('id').isUUID().withMessage('Invalid refund ID'),
      body('comment').optional().isString().isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
    ],
    execute: [
      param('id').isUUID().withMessage('Invalid refund ID')
    ],
    list: [
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
    ]
  };

  static async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderId, amount, reason } = req.body;
    const requestIdempotencyKey = req.headers['x-idempotency-key'] || null;

    const result = await RefundService.createRefund({
      orderId,
      amount,
      reason,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      requestIdempotencyKey,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(201).json(result);
    }

    return res.status(400).json(result);
  }

  static async approve(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { comment } = req.body;

    const result = await RefundService.approveRefund({
      refundId: id,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      comment,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json(result);
  }

  static async reject(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { comment } = req.body;

    const result = await RefundService.rejectRefund({
      refundId: id,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      comment,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json(result);
  }

  static async execute(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const executeIdempotencyKey = req.headers['x-idempotency-key'] || null;

    const result = await RefundService.executeRefund({
      refundId: id,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      executeIdempotencyKey,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json(result);
  }

  static async executeAsync(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const task = await TaskService.createTask({
      name: TaskService.TASK_NAMES.EXECUTE_REFUND,
      payload: {
        refundId: id,
        operatorId: req.headers['x-operator-id'] || 'system',
        operatorName: req.headers['x-operator-name'] || 'System'
      }
    });

    return res.status(202).json({
      success: true,
      message: 'Refund execution queued',
      taskId: task.id
    });
  }

  static async getById(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const refund = await RefundService.getRefundById(id);

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    return res.status(200).json({
      success: true,
      refund
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

    const { limit = 20, offset = 0, orderId, status, startDate, endDate } = req.query;

    const result = await RefundService.getRefunds({
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderId,
      status,
      startDate,
      endDate
    });

    return res.status(200).json({
      success: true,
      refunds: result.rows,
      count: result.count
    });
  }
}

module.exports = RefundController;