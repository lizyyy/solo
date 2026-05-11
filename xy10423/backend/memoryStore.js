const { v4: uuidv4 } = require('uuid');

const store = {
  orders: [],
  transactions: [],
  inspections: [],
  deductions: [],
  refunds: [],
  renewals: []
};

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${dateStr}${random}`;
}

function getCurrentBalance(orderId) {
  const orderTxs = store.transactions
    .filter(tx => tx.order_id === orderId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return orderTxs.length > 0 ? orderTxs[0].balance : 0;
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

  const tx = {
    id: uuidv4(),
    order_id: orderId,
    tx_type: txType,
    amount: amount,
    balance: newBalance,
    description: description,
    operator: operator,
    created_at: new Date().toISOString()
  };
  
  store.transactions.push(tx);
  return { id: tx.id, balance: newBalance };
}

function createOrder(orderData) {
  const now = new Date().toISOString();
  const order = {
    id: uuidv4(),
    order_no: generateOrderNo(),
    customer_name: orderData.customer_name,
    customer_phone: orderData.customer_phone || '',
    item_type: orderData.item_type,
    item_name: orderData.item_name,
    deposit_amount: orderData.deposit_amount,
    rent_amount: orderData.rent_amount,
    rent_unit: orderData.rent_unit || 'day',
    start_date: orderData.start_date,
    expected_return_date: orderData.expected_return_date,
    actual_return_date: null,
    status: 'active',
    remark: orderData.remark || '',
    created_at: now,
    updated_at: now
  };
  
  store.orders.push(order);
  createTransaction(order.id, 'freeze', order.deposit_amount, '押金冻结', '系统');
  
  return getOrderDetail(order.id);
}

function getOrderDetail(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) return null;

  return {
    ...order,
    current_balance: getCurrentBalance(orderId),
    transactions: store.transactions.filter(tx => tx.order_id === orderId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    inspections: store.inspections.filter(i => i.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    deductions: store.deductions.filter(d => d.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    refunds: store.refunds.filter(r => r.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    renewals: store.renewals.filter(r => r.order_id === orderId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  };
}

function listOrders(params = {}) {
  const { status, item_type, keyword } = params;
  
  return store.orders
    .filter(order => {
      if (status && order.status !== status) return false;
      if (item_type && order.item_type !== item_type) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (!order.order_no.toLowerCase().includes(kw) &&
            !order.customer_name.toLowerCase().includes(kw) &&
            !order.item_name.toLowerCase().includes(kw)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(order => ({
      ...order,
      current_balance: getCurrentBalance(order.id)
    }));
}

function processRenewal(orderId, renewalData) {
  const order = store.orders.find(o => o.id === orderId);
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
  
  const expectedDate = new Date(order.expected_return_date);
  expectedDate.setDate(expectedDate.getDate() + additional_days);
  const newExpectedReturnDate = expectedDate.toISOString().split('T')[0];

  store.renewals.push({
    id: uuidv4(),
    order_id: orderId,
    renewal_date: now.toISOString(),
    additional_days: additional_days,
    additional_rent: additional_rent,
    new_expected_return_date: newExpectedReturnDate,
    created_at: now.toISOString()
  });

  order.expected_return_date = newExpectedReturnDate;
  order.updated_at = now.toISOString();

  createTransaction(orderId, 'additional_freeze', additional_rent, `续租${additional_days}天追加租金`, operator || '系统');

  return { success: true, order: getOrderDetail(orderId) };
}

function recordInspection(orderId, inspectionData) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  const now = new Date().toISOString();
  const inspection = {
    id: uuidv4(),
    order_id: orderId,
    inspection_date: now,
    status: inspectionData.status,
    damage_report: inspectionData.damage_report || '',
    estimated_cost: inspectionData.estimated_cost || 0,
    operator: inspectionData.operator || '系统',
    created_at: now
  };
  
  store.inspections.push(inspection);
  return { success: true, inspection: inspection };
}

function createDeduction(orderId, deductionData) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  const balance = getCurrentBalance(orderId);
  if (deductionData.amount > balance) {
    return { success: false, error: '扣款金额不能超过当前可用余额' };
  }

  const now = new Date().toISOString();
  const deduction = {
    id: uuidv4(),
    order_id: orderId,
    inspection_id: deductionData.inspection_id || null,
    amount: deductionData.amount,
    reason: deductionData.reason,
    status: 'pending',
    approved_by: null,
    approved_at: null,
    created_at: now
  };
  
  store.deductions.push(deduction);
  return { success: true, deduction: deduction };
}

function approveDeduction(deductionId, approvedBy) {
  const deduction = store.deductions.find(d => d.id === deductionId);
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
  deduction.status = 'approved';
  deduction.approved_by = approvedBy || '管理员';
  deduction.approved_at = now;

  createTransaction(deduction.order_id, 'deduction', deduction.amount, `扣款: ${deduction.reason}`, approvedBy || '管理员');

  return { success: true, deduction: { ...deduction } };
}

function createRefund(orderId, refundData) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status !== 'returned') {
    return { success: false, error: '未归还设备不能申请退押' };
  }

  const balance = getCurrentBalance(orderId);
  if (refundData.amount > balance) {
    return { success: false, error: '退押金额不能超过当前可用余额' };
  }

  const pendingRefund = store.refunds.find(r => r.order_id === orderId && r.status === 'pending');
  if (pendingRefund) {
    return { success: false, error: '已有待审核的退押申请' };
  }

  const now = new Date().toISOString();
  const refund = {
    id: uuidv4(),
    order_id: orderId,
    amount: refundData.amount,
    status: 'pending',
    approved_by: null,
    approved_at: null,
    reject_reason: null,
    created_at: now
  };
  
  store.refunds.push(refund);
  return { success: true, refund: refund };
}

function approveRefund(refundId, approvedBy) {
  const refund = store.refunds.find(r => r.id === refundId);
  if (!refund) {
    return { success: false, error: '退押记录不存在' };
  }

  if (refund.status !== 'pending') {
    return { success: false, error: '不能重复处理退押' };
  }

  const order = store.orders.find(o => o.id === refund.order_id);
  if (order.status !== 'returned') {
    return { success: false, error: '未归还设备不能退押' };
  }

  const balance = getCurrentBalance(refund.order_id);
  if (refund.amount > balance) {
    return { success: false, error: '退押金额超过当前可用余额' };
  }

  const now = new Date().toISOString();
  refund.status = 'approved';
  refund.approved_by = approvedBy || '管理员';
  refund.approved_at = now;

  createTransaction(refund.order_id, 'refund', refund.amount, '押金退还', approvedBy || '管理员');

  const newBalance = getCurrentBalance(refund.order_id);
  if (newBalance === 0) {
    order.status = 'closed';
    order.updated_at = now;
  }

  return { success: true, refund: { ...refund } };
}

function rejectRefund(refundId, rejectReason, rejectedBy) {
  const refund = store.refunds.find(r => r.id === refundId);
  if (!refund) {
    return { success: false, error: '退押记录不存在' };
  }

  if (refund.status !== 'pending') {
    return { success: false, error: '不能重复处理退押' };
  }

  const now = new Date().toISOString();
  refund.status = 'rejected';
  refund.approved_by = rejectedBy || '管理员';
  refund.approved_at = now;
  refund.reject_reason = rejectReason;

  return { success: true, refund: { ...refund } };
}

function markReturned(orderId) {
  const order = store.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  if (order.status !== 'active') {
    return { success: false, error: '订单状态不允许标记为归还' };
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  order.status = 'returned';
  order.actual_return_date = today;
  order.updated_at = now.toISOString();

  return { success: true, order: getOrderDetail(orderId) };
}

function getPendingApprovals() {
  const pendingDeductions = store.deductions
    .filter(d => d.status === 'pending')
    .map(d => {
      const order = store.orders.find(o => o.id === d.order_id);
      return {
        ...d,
        order_no: order ? order.order_no : '',
        customer_name: order ? order.customer_name : '',
        item_name: order ? order.item_name : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const pendingRefunds = store.refunds
    .filter(r => r.status === 'pending')
    .map(r => {
      const order = store.orders.find(o => o.id === r.order_id);
      return {
        ...r,
        order_no: order ? order.order_no : '',
        customer_name: order ? order.customer_name : '',
        item_name: order ? order.item_name : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    deductions: pendingDeductions,
    refunds: pendingRefunds
  };
}

function getAllTransactions() {
  return store.transactions
    .map(tx => {
      const order = store.orders.find(o => o.id === tx.order_id);
      return {
        ...tx,
        order_no: order ? order.order_no : '',
        customer_name: order ? order.customer_name : ''
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getDepositBalanceReport() {
  return store.orders
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(order => {
      const balance = getCurrentBalance(order.id);
      const totalFreeze = store.transactions
        .filter(tx => tx.order_id === order.id && (tx.tx_type === 'freeze' || tx.tx_type === 'additional_freeze'))
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const totalDeduction = store.transactions
        .filter(tx => tx.order_id === order.id && tx.tx_type === 'deduction')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const totalRefund = store.transactions
        .filter(tx => tx.order_id === order.id && tx.tx_type === 'refund')
        .reduce((sum, tx) => sum + tx.amount, 0);

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
  if (store.orders.length > 0) {
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
    const order = createOrder(sample);
    if (!order) continue;

    if (sample.customer_name === '李四') {
      processRenewal(order.id, { additional_days: 5, additional_rent: 1500, operator: '业务员小王' });
      markReturned(order.id);
      recordInspection(order.id, {
        status: 'damaged',
        damage_report: '投影仪镜头有轻微划痕，外观有磕碰痕迹',
        estimated_cost: 500,
        operator: '质检员小李'
      });
      createDeduction(order.id, {
        amount: 500,
        reason: '设备损坏赔偿 - 镜头划痕',
        operator: '质检员小李'
      });
    }

    if (sample.customer_name === '王五') {
      processRenewal(order.id, { additional_days: 3, additional_rent: 2400, operator: '业务员小张' });
    }

    if (sample.customer_name === '赵六') {
      markReturned(order.id);
      recordInspection(order.id, {
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
