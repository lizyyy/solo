const express = require('express');
const { Order, OrderStatus } = require('../models/Order');
const { IdempotencyMiddleware } = require('../middleware/idempotency');
const { AuditLog, AuditAction } = require('../models/AuditLog');

const router = express.Router();

router.post(
  '/',
  IdempotencyMiddleware.checkIdempotencyKey({ required: true }),
  IdempotencyMiddleware.createIdempotencyRecord,
  IdempotencyMiddleware.wrapIdempotentHandler(async (req, res) => {
    const { user_id, product_name, amount } = req.body;

    if (!user_id || !product_name || !amount) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
        message: 'user_id, product_name and amount are required'
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number'
      });
    }

    const order = await Order.create({
      user_id,
      product_name,
      amount
    });

    await AuditLog.create({
      user_id,
      action: AuditAction.ORDER_CREATE,
      resource_type: 'order',
      resource_id: order.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: {
        product_name,
        amount,
        status: order.status
      }
    });

    return {
      success: true,
      code: 'ORDER_CREATED',
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          user_id: order.user_id,
          product_name: order.product_name,
          amount: order.amount,
          status: order.status,
          created_at: order.created_at
        }
      }
    };
  })
);

router.get('/', async (req, res) => {
  const { user_id, status, limit = 20, offset = 0 } = req.query;
  
  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (user_id) options.userId = user_id;
  if (status) options.status = status;

  const orders = await Order.list(options);
  const total = await Order.count({ userId: user_id, status });

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total
      }
    }
  });
});

router.get('/:orderId', async (req, res) => {
  const { orderId } = req.params;
  
  const order = await Order.findById(orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'Order not found'
    });
  }

  res.json({
    success: true,
    data: { order }
  });
});

router.patch('/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status || !Object.values(OrderStatus).includes(status)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_STATUS',
      message: `Invalid status. Valid values: ${Object.values(OrderStatus).join(', ')}`
    });
  }

  const order = await Order.findById(orderId);
  
  if (!order) {
    return res.status(404).json({
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'Order not found'
    });
  }

  const updatedOrder = await Order.updateStatus(orderId, status);

  await AuditLog.create({
    user_id: order.user_id,
    action: AuditAction.ORDER_UPDATE,
    resource_type: 'order',
    resource_id: orderId,
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    details: {
      old_status: order.status,
      new_status: status
    }
  });

  res.json({
    success: true,
    code: 'ORDER_UPDATED',
    message: 'Order status updated',
    data: { order: updatedOrder }
  });
});

module.exports = router;
