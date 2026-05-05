const express = require('express');
const { Order, OrderStatus } = require('../models/Order');
const { PaymentTransaction, TransactionStatus } = require('../models/PaymentTransaction');
const { CallbackEvent, CallbackType, CallbackStatus } = require('../models/CallbackEvent');
const { IdempotencyMiddleware } = require('../middleware/idempotency');
const { AuditLog, AuditAction } = require('../models/AuditLog');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.post(
  '/',
  IdempotencyMiddleware.checkIdempotencyKey({ required: true }),
  IdempotencyMiddleware.createIdempotencyRecord,
  IdempotencyMiddleware.wrapIdempotentHandler(async (req, res) => {
    const { order_id, payment_method, amount } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REQUEST',
        message: 'order_id is required'
      });
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      });
    }

    if (order.status !== OrderStatus.PENDING) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_ALREADY_PROCESSED',
        message: `Order is already ${order.status}`
      });
    }

    const transactionAmount = amount || order.amount;

    if (transactionAmount !== order.amount) {
      return res.status(400).json({
        success: false,
        code: 'AMOUNT_MISMATCH',
        message: `Payment amount ${transactionAmount} does not match order amount ${order.amount}`
      });
    }

    const transaction = await PaymentTransaction.create({
      order_id: order.id,
      amount: transactionAmount,
      payment_method: payment_method || 'default',
      status: TransactionStatus.PENDING
    });

    await AuditLog.create({
      user_id: order.user_id,
      action: AuditAction.PAYMENT_CREATE,
      resource_type: 'payment_transaction',
      resource_id: transaction.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: {
        order_id: order.id,
        amount: transactionAmount,
        payment_method
      }
    });

    await PaymentTransaction.updateStatus(transaction.id, TransactionStatus.PROCESSING);

    await AuditLog.create({
      user_id: order.user_id,
      action: AuditAction.PAYMENT_PROCESS,
      resource_type: 'payment_transaction',
      resource_id: transaction.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: {
        gateway_transaction_id: null,
        status: TransactionStatus.PROCESSING
      }
    });

    const gatewayTransactionId = `GATEWAY_${uuidv4().substring(0, 12).toUpperCase()}`;
    
    await PaymentTransaction.updateStatus(
      transaction.id, 
      TransactionStatus.SUCCESS,
      gatewayTransactionId
    );

    await Order.updateStatus(order.id, OrderStatus.PAID);

    await AuditLog.create({
      user_id: order.user_id,
      action: AuditAction.PAYMENT_SUCCESS,
      resource_type: 'payment_transaction',
      resource_id: transaction.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: {
        gateway_transaction_id: gatewayTransactionId,
        amount: transactionAmount
      }
    });

    const updatedTransaction = await PaymentTransaction.findById(transaction.id);
    const updatedOrder = await Order.findById(order.id);

    return {
      success: true,
      code: 'PAYMENT_SUCCESS',
      message: 'Payment processed successfully',
      data: {
        order: {
          id: updatedOrder.id,
          status: updatedOrder.status,
          amount: updatedOrder.amount
        },
        transaction: {
          id: updatedTransaction.id,
          status: updatedTransaction.status,
          gateway_transaction_id: updatedTransaction.gateway_transaction_id,
          amount: updatedTransaction.amount
        }
      }
    };
  })
);

router.post(
  '/callback',
  IdempotencyMiddleware.checkIdempotencyKey({ 
    required: true, 
    enforceFingerprint: true 
  }),
  IdempotencyMiddleware.createIdempotencyRecord,
  IdempotencyMiddleware.wrapIdempotentHandler(async (req, res) => {
    const { 
      gateway_transaction_id, 
      order_id,
      transaction_id,
      status, 
      amount,
      callback_type
    } = req.body;

    const callbackType = callback_type || 
      (status === 'success' ? CallbackType.PAYMENT_SUCCESS : CallbackType.PAYMENT_FAILED);

    await CallbackEvent.create({
      order_id: order_id || null,
      transaction_id: transaction_id || null,
      callback_type: callbackType,
      callback_data: {
        gateway_transaction_id,
        status,
        amount,
        raw_payload: req.body
      },
      status: CallbackStatus.RECEIVED
    });

    await AuditLog.create({
      action: AuditAction.CALLBACK_RECEIVE,
      resource_type: 'callback_event',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: {
        gateway_transaction_id,
        order_id,
        status,
        callback_type: callbackType
      }
    });

    if (!gateway_transaction_id && !order_id && !transaction_id) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CALLBACK',
        message: 'gateway_transaction_id, order_id or transaction_id is required'
      });
    }

    let transaction = null;
    let order = null;

    if (gateway_transaction_id) {
      transaction = await PaymentTransaction.findByGatewayTransactionId(gateway_transaction_id);
    }

    if (!transaction && transaction_id) {
      transaction = await PaymentTransaction.findById(transaction_id);
    }

    if (!transaction && order_id) {
      const transactions = await PaymentTransaction.findByOrderId(order_id);
      if (transactions.length > 0) {
        transaction = transactions[0];
      }
      order = await Order.findById(order_id);
    }

    if (!transaction && gateway_transaction_id) {
      return res.status(200).json({
        success: true,
        code: 'CALLBACK_ACKNOWLEDGED',
        message: 'Callback acknowledged, but transaction not found. Will be processed later.',
        data: {
          status: 'pending_lookup',
          gateway_transaction_id
        }
      });
    }

    if (transaction) {
      order = await Order.findById(transaction.order_id);

      if (transaction.status === TransactionStatus.SUCCESS || 
          transaction.status === TransactionStatus.FAILED) {
        await AuditLog.create({
          user_id: order?.user_id,
          action: AuditAction.CALLBACK_DUPLICATE,
          resource_type: 'payment_transaction',
          resource_id: transaction.id,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          details: {
            gateway_transaction_id,
            current_status: transaction.status
          }
        });

        return {
          success: true,
          code: 'CALLBACK_DUPLICATE',
          message: 'Callback has already been processed',
          idempotency_hit: true,
          data: {
            transaction: {
              id: transaction.id,
              status: transaction.status,
              gateway_transaction_id: transaction.gateway_transaction_id
            }
          }
        };
      }

      const newStatus = status === 'success' ? TransactionStatus.SUCCESS : TransactionStatus.FAILED;
      await PaymentTransaction.updateStatus(
        transaction.id,
        newStatus,
        gateway_transaction_id || transaction.gateway_transaction_id
      );

      if (order && newStatus === TransactionStatus.SUCCESS) {
        await Order.updateStatus(order.id, OrderStatus.PAID);
      }

      await AuditLog.create({
        user_id: order?.user_id,
        action: newStatus === TransactionStatus.SUCCESS 
          ? AuditAction.PAYMENT_SUCCESS 
          : AuditAction.PAYMENT_FAILED,
        resource_type: 'payment_transaction',
        resource_id: transaction.id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        details: {
          gateway_transaction_id,
          callback_status: status
        }
      });
    }

    const updatedTransaction = transaction ? await PaymentTransaction.findById(transaction.id) : null;
    const updatedOrder = order ? await Order.findById(order.id) : null;

    return {
      success: true,
      code: 'CALLBACK_PROCESSED',
      message: 'Payment callback processed successfully',
      data: {
        order: updatedOrder ? {
          id: updatedOrder.id,
          status: updatedOrder.status
        } : null,
        transaction: updatedTransaction ? {
          id: updatedTransaction.id,
          status: updatedTransaction.status,
          gateway_transaction_id: updatedTransaction.gateway_transaction_id
        } : null
      }
    };
  })
);

router.get('/', async (req, res) => {
  const { order_id, status, limit = 20, offset = 0 } = req.query;
  
  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (order_id) options.orderId = order_id;
  if (status) options.status = status;

  const transactions = await PaymentTransaction.list(options);
  const total = await PaymentTransaction.count({ orderId: order_id, status });

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total
      }
    }
  });
});

router.get('/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  const transaction = await PaymentTransaction.findById(transactionId);
  
  if (!transaction) {
    return res.status(404).json({
      success: false,
      code: 'TRANSACTION_NOT_FOUND',
      message: 'Transaction not found'
    });
  }

  res.json({
    success: true,
    data: { transaction }
  });
});

module.exports = router;
