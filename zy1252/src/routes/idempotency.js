const express = require('express');
const { IdempotencyKey, IdempotencyStatus } = require('../models/IdempotencyKey');
const { RequestFingerprint } = require('../models/RequestFingerprint');
const { CallbackEvent, CallbackType, CallbackStatus } = require('../models/CallbackEvent');
const { AuditLog, AuditAction } = require('../models/AuditLog');
const { Order, OrderStatus } = require('../models/Order');
const { PaymentTransaction, TransactionStatus } = require('../models/PaymentTransaction');

const router = express.Router();

router.get('/', async (req, res) => {
  const { key, status, limit = 20, offset = 0 } = req.query;
  
  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (status) options.status = status;

  const records = await IdempotencyKey.list(options);
  const total = await IdempotencyKey.count({ status });

  res.json({
    success: true,
    data: {
      records,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total
      }
    }
  });
});

router.get('/:key', async (req, res) => {
  const { key } = req.params;
  
  const record = await IdempotencyKey.findByKey(key);
  
  if (!record) {
    return res.status(404).json({
      success: false,
      code: 'IDEMPOTENCY_KEY_NOT_FOUND',
      message: 'Idempotency key not found'
    });
  }

  const fingerprints = await RequestFingerprint.findByIdempotencyKeyId(record.id);

  res.json({
    success: true,
    data: {
      record: {
        ...record,
        response_data: record.response_data ? JSON.parse(record.response_data) : null
      },
      fingerprints
    }
  });
});

router.get('/stats/summary', async (req, res) => {
  const idempotencyStats = await IdempotencyKey.getStatistics();
  const callbackStats = await CallbackEvent.getStatistics();
  const auditStats = await AuditLog.getStatistics();
  
  const totalOrders = await Order.count();
  const totalTransactions = await PaymentTransaction.count();
  const totalCallbacks = await CallbackEvent.count();
  const totalIdempotencyKeys = await IdempotencyKey.count();

  const paidOrders = await Order.count({ status: OrderStatus.PAID });
  const pendingOrders = await Order.count({ status: OrderStatus.PENDING });
  const successTransactions = await PaymentTransaction.count({ status: TransactionStatus.SUCCESS });
  const failedTransactions = await PaymentTransaction.count({ status: TransactionStatus.FAILED });
  const duplicateCallbacks = await CallbackEvent.count({ status: CallbackStatus.DUPLICATE });

  res.json({
    success: true,
    data: {
      summary: {
        total_orders: totalOrders,
        total_transactions: totalTransactions,
        total_callbacks: totalCallbacks,
        total_idempotency_keys: totalIdempotencyKeys
      },
      statistics: {
        orders_by_status: {
          pending: pendingOrders,
          paid: paidOrders
        },
        transactions_by_status: {
          success: successTransactions,
          failed: failedTransactions
        },
        callbacks_by_status: {
          duplicate: duplicateCallbacks
        },
        idempotency_by_status: idempotencyStats.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        audit_actions: auditStats,
        callback_types: callbackStats
      },
      order_status: {
        pending: pendingOrders,
        paid: paidOrders
      },
      transaction_status: {
        success: successTransactions,
        failed: failedTransactions
      },
      callback_status: {
        duplicate: duplicateCallbacks
      },
      idempotency_status: idempotencyStats,
      audit_actions: auditStats,
      callback_types: callbackStats
    }
  });
});

router.get('/logs/audit', async (req, res) => {
  const { action, resource_type, user_id, limit = 20, offset = 0, start_date, end_date } = req.query;
  
  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (action) options.action = action;
  if (resource_type) options.resourceType = resource_type;
  if (user_id) options.userId = user_id;
  if (start_date) options.startDate = start_date;
  if (end_date) options.endDate = end_date;

  const logs = await AuditLog.list(options);
  const total = await AuditLog.count(options);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total
      }
    }
  });
});

router.get('/callbacks', async (req, res) => {
  const { order_id, transaction_id, status, callback_type, limit = 20, offset = 0 } = req.query;
  
  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset)
  };

  if (status) options.status = status;
  if (callback_type) options.callbackType = callback_type;
  if (order_id) options.orderId = order_id;

  const callbacks = await CallbackEvent.list(options);
  const total = await CallbackEvent.count(options);

  res.json({
    success: true,
    data: {
      callbacks,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total
      }
    }
  });
});

router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  
  const deleted = await IdempotencyKey.deleteByKey(key);
  
  if (!deleted) {
    return res.status(404).json({
      success: false,
      code: 'IDEMPOTENCY_KEY_NOT_FOUND',
      message: 'Idempotency key not found'
    });
  }

  res.json({
    success: true,
    code: 'IDEMPOTENCY_KEY_DELETED',
    message: 'Idempotency key deleted successfully'
  });
});

module.exports = router;
