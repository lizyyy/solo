const { body, param, validationResult, query } = require('express-validator');
const OrderService = require('../services/orderService');

class OrderController {
  static validationRules = {
    create: [
      body('orderNo').isString().isLength({ min: 1, max: 50 }).withMessage('Order number must be between 1 and 50 characters'),
      body('userId').isString().isLength({ min: 1, max: 50 }).withMessage('User ID must be between 1 and 50 characters'),
      body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0')
    ],
    updateStatus: [
      param('id').isUUID().withMessage('Invalid order ID'),
      body('status').isIn(['pending', 'paid', 'shipped', 'completed']).withMessage('Invalid status')
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

    const { orderNo, userId, amount } = req.body;

    const result = await OrderService.createOrder({
      orderNo,
      userId,
      amount,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(201).json(result);
    }

    return res.status(400).json(result);
  }

  static async updateStatus(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const result = await OrderService.updateOrderStatus({
      orderId: id,
      status,
      operatorId: req.headers['x-operator-id'] || 'system',
      operatorName: req.headers['x-operator-name'] || 'System',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json(result);
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
    const order = await OrderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  }

  static async getByOrderNo(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { orderNo } = req.params;
    const order = await OrderService.getOrderByOrderNo(orderNo);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      order
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

    const { limit = 20, offset = 0, userId, status, startDate, endDate } = req.query;

    const result = await OrderService.getOrders({
      limit: parseInt(limit),
      offset: parseInt(offset),
      userId,
      status,
      startDate,
      endDate
    });

    return res.status(200).json({
      success: true,
      orders: result.rows,
      count: result.count
    });
  }
}

module.exports = OrderController;