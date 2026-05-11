const db = require('./database');
const { v4: uuidv4 } = require('uuid');

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${dateStr}${random}`;
}

function getCurrentBalance(orderId) {
  const lastTx = db.prepare(`
    SELECT balance FROM transactions 
    WHERE order_id = ? 
    ORDER BY created_at DESC, id DESC 
    LIMIT 1
  `).get(orderId);
  return lastTx ? lastTx.balance : 0;
}

function createTransaction(orderId, txType, amount, description, operator) {
  const currentBalance = getCurrentBalance(orderId);
  let newBalance;
  
  switch (txType) {
    case 'freeze':
    case 'additional_freeze':
      newBalance = currentBalance + amount;
      break;
    case 'deduction':
    case 'refund':
      newBalance = currentBalance - amount;
      break;
    default:
      newBalance = currentBalance;
  }

  const txId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO transactions (id, order_id, tx_type, amount, balance, description, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(txId, orderId, txType, amount, newBalance, description, operator, now);

  return { id: txId, balance: newBalance };
}

function createOrder(orderData) {
  const {
    customer_name,
    customer_phone,
    item_type,
    item_name,
    deposit_amount,
    rent_amount,
    rent_unit,
    start_date,
    expected_return_date,
    remark
  } = orderData;

  const orderId = uuidv4();
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO orders (id, order_no, customer_name, customer_phone, item_type, item_name, 
      deposit_amount, rent_amount, rent_unit, start_date, expected_return_date, 
      status, remark, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    orderId, orderNo, customer_name, customer_phone, item_type, item_name,
    deposit_amount, rent_amount, rent_unit, start_date, expected_return_date,
    remark, now, now
  );

  createTransaction(orderId, 'freeze', deposit_amount, '押金冻结', '系统');

  return getOrderDetail(orderId);
}

function getOrderDetail(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const transactions = db.prepare('SELECT * FROM transactions WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
  const inspections = db.prepare('SELECT * FROM inspections WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
  const deductions = db.prepare('SELECT * FROM deductions WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
  const refunds = db.prepare('SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
  const renewals = db.prepare('SELECT * FROM renewals WHERE order_id = ? ORDER BY created_at DESC').all(orderId);

  const balance = getCurrentBalance(orderId);

  return {
    ...order,
    current_balance: balance,
    transactions,
    inspections,
    deductions,
    refunds,
    renewals
  };
}

function listOrders(params = {}) {
  const { status, item_type, keyword } = params;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const conditions = [];
  const values = [];

  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (item_type) {
    conditions.push('item_type = ?');
    values.push(item_type);
  }
  if (keyword) {
    conditions.push('(order_no LIKE ? OR customer_name LIKE ? OR item_name LIKE ?)');
    const kw = `%${keyword}%`;
    values.push(kw, kw, kw);
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const orders = db.prepare(query).all(...values);
  
  return orders.map(order => ({
    ...order,
    current_balance: getCurrentBalance(order.id)
  }));
}

function processRenewal(orderId, renewalData) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status === 'closed') {
    return { success: false, error: '已关闭订单不能续租' };
  }
  if (order.status === 'returned') {
    return { success: false, error: '已归还订单不能续租' };
  }

  const { additional_days, additional_rent, operator } = renewalData;
  const now = new Date();
  const renewalDate = now.toISOString();
  
  const expectedDate = new Date(order.expected_return_date);
  expectedDate.setDate(expectedDate.getDate() + additional_days);
  const newExpectedReturnDate = expectedDate.toISOString().split('T')[0];

  const renewalId = uuidv4();
  db.prepare(`
    INSERT INTO renewals (id, order_id, renewal_date, additional_days, additional_rent, new_expected_return_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(renewalId, orderId, renewalDate, additional_days, additional_rent, newExpectedReturnDate, renewalDate);

  db.prepare(`
    UPDATE orders 
    SET expected_return_date = ?, updated_at = ?
    WHERE id = ?
  `).run(newExpectedReturnDate, renewalDate, orderId);

  createTransaction(orderId, 'additional_freeze', additional_rent, `续租${additional_days}天追加租金`, operator || '系统');

  return { success: true, order: getOrderDetail(orderId) };
}

function recordInspection(orderId, inspectionData) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  const { status, damage_report, estimated_cost, operator } = inspectionData;
  const inspectionId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO inspections (id, order_id, inspection_date, status, damage_report, estimated_cost, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(inspectionId, orderId, now, status, damage_report, estimated_cost, operator || '系统', now);

  return { success: true, inspection: { id: inspectionId, ...inspectionData, created_at: now } };
}

function createDeduction(orderId, deductionData) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  const { amount, reason, inspection_id, operator } = deductionData;
  const balance = getCurrentBalance(orderId);

  if (amount > balance) {
    return { success: false, error: '扣款金额不能超过当前可用余额' };
  }

  const deductionId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO deductions (id, order_id, inspection_id, amount, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(deductionId, orderId, inspection_id, amount, reason, now);

  return { success: true, deduction: { id: deductionId, ...deductionData, status: 'pending', created_at: now } };
}

function approveDeduction(deductionId, approvedBy) {
  const deduction = db.prepare('SELECT * FROM deductions WHERE id = ?').get(deductionId);
  if (!deduction) {
    return { success: false, error: '扣款记录不存在' };
  }

  if (deduction.status !== 'pending') {
    return { success: false, error: '不能重复处理扣款' };
  }

  const balance = getCurrentBalance(deduction.order_id);
  if (deduction.amount > balance) {
    return { success: false, error: '扣款金额超过当前可用余额' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE deductions 
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(approvedBy || '管理员', now, deductionId);

  createTransaction(deduction.order_id, 'deduction', deduction.amount, `扣款: ${deduction.reason}`, approvedBy || '管理员');

  return { success: true, deduction: { ...deduction, status: 'approved', approved_by: approvedBy, approved_at: now } };
}

function createRefund(orderId, refundData) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status !== 'returned') {
    return { success: false, error: '未归还设备不能申请退押' };
  }

  const { amount } = refundData;
  const balance = getCurrentBalance(orderId);

  if (amount > balance) {
    return { success: false, error: '退押金额不能超过当前可用余额' };
  }

  const pendingRefund = db.prepare(`
    SELECT * FROM refunds 
    WHERE order_id = ? AND status = 'pending'
  `).get(orderId);

  if (pendingRefund) {
    return { success: false, error: '已有待审核的退押申请' };
  }

  const refundId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO refunds (id, order_id, amount, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(refundId, orderId, amount, now);

  return { success: true, refund: { id: refundId, ...refundData, status: 'pending', created_at: now } };
}

function approveRefund(refundId, approvedBy) {
  const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
  if (!refund) {
    return { success: false, error: '退押记录不存在' };
  }

  if (refund.status !== 'pending') {
    return { success: false, error: '不能重复处理退押' };
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(refund.order_id);
  if (order.status !== 'returned') {
    return { success: false, error: '未归还设备不能退押' };
  }

  const balance = getCurrentBalance(refund.order_id);
  if (refund.amount > balance) {
    return { success: false, error: '退押金额超过当前可用余额' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE refunds 
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(approvedBy || '管理员', now, refundId);

  createTransaction(refund.order_id, 'refund', refund.amount, '押金退还', approvedBy || '管理员');

  const newBalance = getCurrentBalance(refund.order_id);
  if (newBalance === 0) {
    db.prepare(`
      UPDATE orders 
      SET status = 'closed', updated_at = ?
      WHERE id = ?
    `).run(now, refund.order_id);
  }

  return { success: true, refund: { ...refund, status: 'approved', approved_by: approvedBy, approved_at: now } };
}

function rejectRefund(refundId, rejectReason, rejectedBy) {
  const refund = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
  if (!refund) {
    return { success: false, error: '退押记录不存在' };
  }

  if (refund.status !== 'pending') {
    return { success: false, error: '不能重复处理退押' };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE refunds 
    SET status = 'rejected', approved_by = ?, approved_at = ?, reject_reason = ?
    WHERE id = ?
  `).run(rejectedBy || '管理员', now, rejectReason, refundId);

  return { success: true, refund: { ...refund, status: 'rejected', approved_by: rejectedBy, approved_at: now, reject_reason: rejectReason } };
}

function markReturned(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status !== 'active') {
    return { success: false, error: '订单状态不允许标记为归还' };
  }

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  db.prepare(`
    UPDATE orders 
    SET status = 'returned', actual_return_date = ?, updated_at = ?
    WHERE id = ?
  `).run(today, now, orderId);

  return { success: true, order: getOrderDetail(orderId) };
}

function getPendingApprovals() {
  const pendingDeductions = db.prepare(`
    SELECT d.*, o.order_no, o.customer_name, o.item_name
    FROM deductions d
    JOIN orders o ON d.order_id = o.id
    WHERE d.status = 'pending'
    ORDER BY d.created_at DESC
  `).all();

  const pendingRefunds = db.prepare(`
    SELECT r.*, o.order_no, o.customer_name, o.item_name
    FROM refunds r
    JOIN orders o ON r.order_id = o.id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC
  `).all();

  return {
    deductions: pendingDeductions,
    refunds: pendingRefunds
  };
}

function getAllTransactions() {
  return db.prepare(`
    SELECT t.*, o.order_no, o.customer_name
    FROM transactions t
    JOIN orders o ON t.order_id = o.id
    ORDER BY t.created_at DESC
  `).all();
}

function getDepositBalanceReport() {
  const orders = db.prepare(`
    SELECT * FROM orders 
    ORDER BY created_at DESC
  `).all();

  return orders.map(order => {
    const balance = getCurrentBalance(order.id);
    const totalFreeze = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE order_id = ? AND tx_type IN ('freeze', 'additional_freeze')
    `).get(order.id).total;

    const totalDeduction = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE order_id = ? AND tx_type = 'deduction'
    `).get(order.id).total;

    const totalRefund = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM transactions 
      WHERE order_id = ? AND tx_type = 'refund'
    `).get(order.id).total;

    return {
      order_no: order.order_no,
      customer_name: order.customer_name,
      item_type: order.item_type,
      item_name: order.item_name,
      status: order.status,
      total_freeze: totalFreeze,
      total_deduction: totalDeduction,
      total_refund: totalRefund,
      current_balance: balance,
      start_date: order.start_date,
      expected_return_date: order.expected_return_date,
      actual_return_date: order.actual_return_date
    };
  });
}

function seedSampleData() {
  const tableCount = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get();
  if (!tableCount) return { success: false, error: '数据库表未初始化' };

  const existingOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
  if (existingOrders > 0) {
    return { success: false, error: '样例数据已存在' };
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const samples = [
    {
      customer_name: '张三',
      customer_phone: '13800138001',
      item_type: 'camera',
      item_name: '佳能 EOS R5 专业相机',
      deposit_amount: 15000,
      rent_amount: 500,
      rent_unit: 'day',
      start_date: today,
      expected_return_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remark: '商业拍摄使用'
    },
    {
      customer_name: '李四',
      customer_phone: '13800138002',
      item_type: 'projector',
      item_name: '爱普生 CB-L630SU 激光投影仪',
      deposit_amount: 8000,
      rent_amount: 300,
      rent_unit: 'day',
      start_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expected_return_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remark: '企业年会使用'
    },
    {
      customer_name: '王五',
      customer_phone: '13800138003',
      item_type: 'drone',
      item_name: '大疆 Mavic 3 Cine 无人机',
      deposit_amount: 25000,
      rent_amount: 800,
      rent_unit: 'day',
      start_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expected_return_date: today,
      remark: '房地产航拍'
    },
    {
      customer_name: '赵六',
      customer_phone: '13800138004',
      item_type: 'camera',
      item_name: '索尼 A7S III 摄像机',
      deposit_amount: 18000,
      rent_amount: 600,
      rent_unit: 'day',
      start_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expected_return_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remark: '纪录片拍摄'
    }
  ];

  for (const sample of samples) {
    const result = createOrder(sample);
    if (!result) continue;

    if (sample.customer_name === '李四') {
      processRenewal(result.id, { additional_days: 5, additional_rent: 1500, operator: '业务员小王' });
      markReturned(result.id);
      recordInspection(result.id, {
        status: 'damaged',
        damage_report: '投影仪镜头有轻微划痕，外观有磕碰痕迹',
        estimated_cost: 500,
        operator: '质检员小李'
      });
      createDeduction(result.id, {
        amount: 500,
        reason: '设备损坏赔偿 - 镜头划痕',
        operator: '质检员小李'
      });
    }

    if (sample.customer_name === '王五') {
      processRenewal(result.id, { additional_days: 3, additional_rent: 2400, operator: '业务员小张' });
    }

    if (sample.customer_name === '赵六') {
      markReturned(result.id);
      recordInspection(result.id, {
        status: 'good',
        damage_report: '设备完好，无损坏',
        estimated_cost: 0,
        operator: '质检员小李'
      });
    }
  }

  return { success: true, message: '样例数据创建成功' };
}

module.exports = {
  createOrder,
  getOrderDetail,
  listOrders,
  processRenewal,
  recordInspection,
  createDeduction,
  approveDeduction,
  createRefund,
  approveRefund,
  rejectRefund,
  markReturned,
  getPendingApprovals,
  getAllTransactions,
  getDepositBalanceReport,
  seedSampleData
};
