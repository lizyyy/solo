const { getDatabase } = require('../database/init');
const { generateId, generateTransactionNo } = require('../utils/idGenerator');
const { ORDER_STATUS, ORDER_STATUS_FLOW, REFUND_QUEUE_STATUS, REFUND_METHOD, MODULES } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');
const { getOrderById, updateOrderStatus } = require('./orderService');
const { getFeeSummaryByOrderId } = require('./feeService');

const RETRY_DELAY_MS = 5 * 60 * 1000;

function validateRefundQueueData(data) {
  const errors = [];
  if (!data.order_id) errors.push('order_id不能为空');
  if (!data.refund_method || !Object.values(REFUND_METHOD).includes(data.refund_method)) {
    errors.push('refund_method必须是CASH、BANK_TRANSFER或ORIGINAL_PAYMENT');
  }
  return errors;
}

function addToRefundQueue(orderId, refundMethod, operator) {
  const db = getDatabase();
  const order = getOrderById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.status !== ORDER_STATUS.FEE_CALCULATED) {
    throw new Error('只有费用已计算状态的订单才能加入退款队列');
  }

  const existingQueue = db.prepare(`
    SELECT * FROM refund_queue WHERE order_id = ?
  `).get(orderId);

  if (existingQueue) {
    if (existingQueue.status === REFUND_QUEUE_STATUS.SUCCESS) {
      throw new Error('该订单已退款成功');
    }
    throw new Error('该订单已在退款队列中');
  }

  const summary = getFeeSummaryByOrderId(orderId);
  if (!summary) {
    throw new Error('费用汇总不存在，请先计算费用');
  }

  const now = new Date().toISOString();
  const queueId = generateId();

  db.prepare(`
    INSERT INTO refund_queue (
      id, order_id, refund_amount, refund_method, status,
      retry_count, max_retries, next_retry_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    queueId,
    orderId,
    summary.refund_amount,
    refundMethod,
    REFUND_QUEUE_STATUS.PENDING,
    0,
    3,
    now,
    now,
    now
  );

  logAudit('ENQUEUE', MODULES.REFUND, operator, {
    targetId: queueId,
    targetType: 'refund_queue',
    newValues: {
      order_id: orderId,
      refund_amount: summary.refund_amount,
      refund_method: refundMethod
    }
  });

  updateOrderStatus(orderId, ORDER_STATUS.REFUND_PENDING, operator, '加入退款队列');

  return getRefundQueueItemById(queueId);
}

function getRefundQueueItemById(queueId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM refund_queue WHERE id = ?
  `).get(queueId);
}

function getRefundQueueItemByOrderId(orderId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM refund_queue WHERE order_id = ?
  `).get(orderId);
}

function getRefundQueue(filters = {}) {
  const db = getDatabase();
  let sql = `SELECT * FROM refund_queue WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }

  if (filters.include_expired) {
    sql += ` AND (next_retry_at IS NULL OR next_retry_at <= ?)`;
    params.push(new Date().toISOString());
  }

  sql += ` ORDER BY created_at ASC`;

  return db.prepare(sql).all(...params);
}

function processRefund(queueId, operator, simulateSuccess = true) {
  const db = getDatabase();
  const queueItem = getRefundQueueItemById(queueId);

  if (!queueItem) {
    throw new Error('退款队列项不存在');
  }

  if (queueItem.status === REFUND_QUEUE_STATUS.SUCCESS) {
    throw new Error('该退款已处理成功');
  }

  const order = getOrderById(queueItem.order_id);
  if (!order) {
    throw new Error('订单不存在');
  }

  const now = new Date().toISOString();
  const recordId = generateId();
  const transactionNo = generateTransactionNo();

  const transaction = db.transaction(() => {
    const refundStatus = simulateSuccess ? 'SUCCESS' : 'FAILED';
    const refundRecordStmt = db.prepare(`
      INSERT INTO refund_records (
        id, queue_id, order_id, refund_amount, refund_method,
        transaction_no, status, operator, operated_at, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    refundRecordStmt.run(
      recordId,
      queueId,
      queueItem.order_id,
      queueItem.refund_amount,
      queueItem.refund_method,
      transactionNo,
      refundStatus,
      operator,
      now,
      simulateSuccess ? '退款成功' : '模拟退款失败'
    );

    if (simulateSuccess) {
      db.prepare(`
        UPDATE refund_queue 
        SET status = ?, processed_by = ?, processed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        REFUND_QUEUE_STATUS.SUCCESS,
        operator,
        now,
        now,
        queueId
      );

      db.prepare(`
        UPDATE rental_orders 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(ORDER_STATUS.COMPLETED, now, queueItem.order_id);

      const logId = generateId();
      db.prepare(`
        INSERT INTO order_status_logs (
          id, order_id, from_status, to_status, changed_by, changed_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        queueItem.order_id,
        order.status,
        ORDER_STATUS.COMPLETED,
        operator,
        now,
        '退款完成'
      );
    } else {
      const newRetryCount = queueItem.retry_count + 1;
      const nextRetryAt = newRetryCount >= queueItem.max_retries
        ? null
        : new Date(Date.now() + RETRY_DELAY_MS * newRetryCount).toISOString();
      
      const newStatus = newRetryCount >= queueItem.max_retries
        ? REFUND_QUEUE_STATUS.MANUAL_REVIEW
        : REFUND_QUEUE_STATUS.FAILED;

      db.prepare(`
        UPDATE refund_queue 
        SET status = ?, retry_count = ?, last_error = ?, 
            next_retry_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        newStatus,
        newRetryCount,
        '模拟退款失败',
        nextRetryAt,
        now,
        queueId
      );

      if (newStatus === REFUND_QUEUE_STATUS.MANUAL_REVIEW) {
        updateOrderStatus(
          queueItem.order_id,
          ORDER_STATUS.REFUND_PENDING,
          operator,
          '自动退款失败，需要人工处理'
        );
      }
    }
  });

  transaction();

  logAudit('PROCESS', MODULES.REFUND, operator, {
    targetId: queueId,
    targetType: 'refund_queue',
    newValues: {
      status: simulateSuccess ? REFUND_QUEUE_STATUS.SUCCESS : REFUND_QUEUE_STATUS.FAILED,
      transaction_no: transactionNo
    }
  });

  return {
    success: simulateSuccess,
    recordId,
    transactionNo,
    queueItem: getRefundQueueItemById(queueId)
  };
}

function retryRefund(queueId, operator) {
  const db = getDatabase();
  const queueItem = getRefundQueueItemById(queueId);

  if (!queueItem) {
    throw new Error('退款队列项不存在');
  }

  if (queueItem.status === REFUND_QUEUE_STATUS.SUCCESS) {
    throw new Error('该退款已处理成功');
  }

  if (queueItem.status !== REFUND_QUEUE_STATUS.FAILED) {
    throw new Error('只有失败状态的退款可以重试');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE refund_queue 
    SET status = ?, next_retry_at = ?, updated_at = ?
    WHERE id = ?
  `).run(REFUND_QUEUE_STATUS.PENDING, now, now, queueId);

  logAudit('RETRY', MODULES.REFUND, operator, {
    targetId: queueId,
    targetType: 'refund_queue',
    remark: '人工触发重试'
  });

  return getRefundQueueItemById(queueId);
}

function manuallyProcessRefund(queueId, operator, transactionNo = null) {
  const db = getDatabase();
  const queueItem = getRefundQueueItemById(queueId);

  if (!queueItem) {
    throw new Error('退款队列项不存在');
  }

  const order = getOrderById(queueItem.order_id);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (queueItem.status === REFUND_QUEUE_STATUS.SUCCESS) {
    throw new Error('该退款已处理成功');
  }

  const now = new Date().toISOString();
  const recordId = generateId();
  const actualTransactionNo = transactionNo || generateTransactionNo();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO refund_records (
        id, queue_id, order_id, refund_amount, refund_method,
        transaction_no, status, operator, operated_at, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      queueId,
      queueItem.order_id,
      queueItem.refund_amount,
      queueItem.refund_method,
      actualTransactionNo,
      'SUCCESS',
      operator,
      now,
      '人工确认退款成功'
    );

    db.prepare(`
      UPDATE refund_queue 
      SET status = ?, processed_by = ?, processed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      REFUND_QUEUE_STATUS.SUCCESS,
      operator,
      now,
      now,
      queueId
    );

    db.prepare(`
      UPDATE rental_orders 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(ORDER_STATUS.COMPLETED, now, queueItem.order_id);

    const logId = generateId();
    db.prepare(`
      INSERT INTO order_status_logs (
        id, order_id, from_status, to_status, changed_by, changed_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      queueItem.order_id,
      order.status,
      ORDER_STATUS.COMPLETED,
      operator,
      now,
      '人工确认退款完成'
    );
  });

  transaction();

  logAudit('MANUAL_PROCESS', MODULES.REFUND, operator, {
    targetId: queueId,
    targetType: 'refund_queue',
    newValues: {
      status: REFUND_QUEUE_STATUS.SUCCESS,
      transaction_no: actualTransactionNo
    },
    remark: '人工处理退款'
  });

  return {
    success: true,
    recordId,
    transactionNo: actualTransactionNo,
    queueItem: getRefundQueueItemById(queueId)
  };
}

function getRefundRecordsByOrderId(orderId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM refund_records 
    WHERE order_id = ? 
    ORDER BY operated_at DESC
  `).all(orderId);
}

function getPendingRefundCount() {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM refund_queue 
    WHERE status IN (?, ?)
  `).get(REFUND_QUEUE_STATUS.PENDING, REFUND_QUEUE_STATUS.FAILED);

  return result.count;
}

module.exports = {
  validateRefundQueueData,
  addToRefundQueue,
  getRefundQueueItemById,
  getRefundQueueItemByOrderId,
  getRefundQueue,
  processRefund,
  retryRefund,
  manuallyProcessRefund,
  getRefundRecordsByOrderId,
  getPendingRefundCount
};
