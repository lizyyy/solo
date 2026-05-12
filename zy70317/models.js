const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');

const now = () => new Date().toISOString();

const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

const DiffType = {
  MISSING_FLOW: 'MISSING_FLOW',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH'
};

const DiffStatus = {
  PENDING: 'PENDING',
  NEED_REVIEW: 'NEED_REVIEW',
  COMPENSATED: 'COMPENSATED',
  CLOSED: 'CLOSED'
};

const TaskStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED'
};

const createOrder = (orderNo, amount) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO business_orders (id, order_no, amount, status, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, orderNo, amount, OrderStatus.PENDING, now(), (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, order_no: orderNo, amount, status: OrderStatus.PENDING });
    });
  });
};

const getOrder = (orderNo) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM business_orders WHERE order_no = ?', [orderNo], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const markOrderPaid = (orderNo) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      'UPDATE business_orders SET status = ?, paid_at = ? WHERE order_no = ?'
    );
    stmt.run(OrderStatus.PAID, now(), orderNo, (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve(true);
    });
  });
};

const cancelOrder = (orderNo) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      'UPDATE business_orders SET status = ?, cancelled_at = ? WHERE order_no = ?'
    );
    stmt.run(OrderStatus.CANCELLED, now(), orderNo, (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve(true);
    });
  });
};

const createAccountingFlow = (orderNo, amount, flowNo) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const finalFlowNo = flowNo || `FLW-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const stmt = db.prepare(
      'INSERT INTO accounting_flows (id, flow_no, order_no, amount, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, finalFlowNo, orderNo, amount, now(), (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, flow_no: finalFlowNo, order_no: orderNo, amount });
    });
  });
};

const getFlowsByOrderNo = (orderNo) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM accounting_flows WHERE order_no = ?', [orderNo], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getPaidOrders = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM business_orders WHERE status IN ('PAID', 'COMPLETED')", (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const createReconciliationScan = (totalOrders, matchedOrders, diffOrders) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const scanDate = new Date().toISOString().split('T')[0];
    const stmt = db.prepare(
      'INSERT INTO reconciliation_scans (id, scan_date, total_orders, matched_orders, diff_orders, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, scanDate, totalOrders, matchedOrders, diffOrders, now(), (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, scan_date: scanDate, total_orders: totalOrders, matched_orders: matchedOrders, diff_orders: diffOrders });
    });
  });
};

const createReconciliationDiff = (scanId, diffType, orderNo, orderAmount, flowAmount, diffReason) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const diffAmount = flowAmount !== null ? orderAmount - flowAmount : orderAmount;
    const status = diffType === DiffType.AMOUNT_MISMATCH ? DiffStatus.NEED_REVIEW : DiffStatus.PENDING;
    const stmt = db.prepare(
      'INSERT INTO reconciliation_diffs (id, diff_type, order_no, order_amount, flow_amount, diff_amount, status, diff_reason, scan_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, diffType, orderNo, orderAmount, flowAmount, diffAmount, status, diffReason, scanId, now(), (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, diff_type: diffType, order_no: orderNo, status, diff_reason: diffReason });
    });
  });
};

const getDiff = (diffId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM reconciliation_diffs WHERE id = ?', [diffId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const getDiffs = (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM reconciliation_diffs WHERE 1=1';
    const params = [];
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.order_no) {
      sql += ' AND order_no = ?';
      params.push(filters.order_no);
    }
    sql += ' ORDER BY created_at DESC';
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const createCompensationTask = (diffId, orderNo, amount) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO compensation_tasks (id, diff_id, order_no, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, diffId, orderNo, amount, TaskStatus.PENDING, now(), (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, diff_id: diffId, order_no: orderNo, amount, status: TaskStatus.PENDING });
    });
  });
};

const getTask = (taskId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM compensation_tasks WHERE id = ?', [taskId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const getTasksByDiffId = (diffId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM compensation_tasks WHERE diff_id = ? ORDER BY created_at DESC', [diffId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const updateTaskStatus = (taskId, status, error = null) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `UPDATE compensation_tasks 
       SET status = ?, retry_count = retry_count + 1, last_error = ?, executed_at = ? 
       WHERE id = ?`
    );
    stmt.run(status, error, now(), taskId, (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve(true);
    });
  });
};

const updateDiffStatus = (diffId, status, closeReason = null) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      'UPDATE reconciliation_diffs SET status = ?, closed_at = ?, close_reason = ? WHERE id = ?'
    );
    const closedAt = status === DiffStatus.CLOSED || status === DiffStatus.COMPENSATED ? now() : null;
    stmt.run(status, closedAt, closeReason, diffId, (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve(true);
    });
  });
};

const createCompensationRecord = (taskId, diffId, orderNo, flowNo, amount, operationType, status, remark = null) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO compensation_records (id, task_id, diff_id, order_no, flow_no, amount, operation_type, status, operated_at, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(id, taskId, diffId, orderNo, flowNo, amount, operationType, status, now(), remark, (err) => {
      if (err) return reject(err);
      stmt.finalize();
      resolve({ id, task_id: taskId, flow_no: flowNo, amount, operation_type: operationType, status });
    });
  });
};

const getCompensationHistory = (diffId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT cr.*, ct.status as task_status, ct.retry_count
      FROM compensation_records cr
      LEFT JOIN compensation_tasks ct ON cr.task_id = ct.id
      WHERE cr.diff_id = ?
      ORDER BY cr.operated_at DESC
    `;
    db.all(sql, [diffId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const getReconciliationSummary = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM business_orders WHERE status IN ('PAID', 'COMPLETED')) as total_paid_orders,
        (SELECT COUNT(DISTINCT order_no) FROM accounting_flows) as total_flows,
        (SELECT COUNT(*) FROM reconciliation_diffs WHERE status = 'PENDING') as pending_diffs,
        (SELECT COUNT(*) FROM reconciliation_diffs WHERE status = 'NEED_REVIEW') as need_review_diffs,
        (SELECT COUNT(*) FROM reconciliation_diffs WHERE status = 'COMPENSATED') as compensated_diffs,
        (SELECT COUNT(*) FROM reconciliation_diffs WHERE status = 'CLOSED') as closed_diffs,
        (SELECT COUNT(*) FROM compensation_tasks WHERE status = 'PENDING') as pending_tasks,
        (SELECT COUNT(*) FROM compensation_tasks WHERE status = 'SUCCESS') as success_tasks,
        (SELECT COUNT(*) FROM compensation_tasks WHERE status = 'FAILED') as failed_tasks
    `;
    db.get(sql, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const getScans = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM reconciliation_scans ORDER BY created_at DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

module.exports = {
  OrderStatus,
  DiffType,
  DiffStatus,
  TaskStatus,
  createOrder,
  getOrder,
  markOrderPaid,
  cancelOrder,
  createAccountingFlow,
  getFlowsByOrderNo,
  getPaidOrders,
  createReconciliationScan,
  createReconciliationDiff,
  getDiff,
  getDiffs,
  createCompensationTask,
  getTask,
  getTasksByDiffId,
  updateTaskStatus,
  updateDiffStatus,
  createCompensationRecord,
  getCompensationHistory,
  getReconciliationSummary,
  getScans,
  now
};
