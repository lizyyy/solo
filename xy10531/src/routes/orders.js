const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../config/store');
const { ORDER_STATUS, CHECKPOINT_TYPE, CHECKPOINT_STATUS } = require('../config/constants');
const {
  updateOrderStatus,
  recordCheckpoint,
  getOrderByNo,
  getOrderById,
  getOrderItems,
  getOrderDocuments,
  getOrderCheckpoints,
  getOrderSupplements,
  getOrderStatusHistory,
  getOrderManualCorrections
} = require('../services/orderService');

router.post('/', (req, res) => {
  const {
    order_no,
    source_order_no,
    warehouse_code,
    destination_country,
    receiver_name,
    receiver_phone,
    receiver_id_number,
    receiver_id_expiry_date,
    total_amount,
    currency,
    items,
    created_by
  } = req.body;

  const idempotentKey = `import_${order_no}`;
  const existingCheck = store.findOne('checkpoints', c => c.idempotent_key === idempotentKey);
  
  if (existingCheck) {
    const existingOrder = getOrderById(existingCheck.order_id);
    return res.json({
      success: true,
      isDuplicate: true,
      message: '订单已存在，幂等性保护',
      data: {
        order_id: existingOrder.id,
        order_no: existingOrder.order_no,
        status: existingOrder.status
      }
    });
  }

  if (!order_no || !warehouse_code || !destination_country || !receiver_name || !items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'warehouse_code', 'destination_country', 'receiver_name', 'items']
    });
  }

  const existingOrder = getOrderByNo(order_no);
  if (existingOrder) {
    return res.status(409).json({
      success: false,
      message: '订单号已存在',
      order_no
    });
  }

  const orderId = uuidv4();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const totalAmt = total_amount || items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const order = store.insert('orders', {
    id: orderId,
    order_no,
    source_order_no: source_order_no || null,
    warehouse_code,
    destination_country,
    receiver_name,
    receiver_phone: receiver_phone || null,
    receiver_id_number: receiver_id_number || null,
    receiver_id_expiry_date: receiver_id_expiry_date || null,
    total_amount: totalAmt,
    currency: currency || 'CNY',
    status: ORDER_STATUS.IMPORTED,
    created_at: now,
    updated_at: now,
    created_by: created_by || 'system',
    remark: null
  });

  items.forEach(item => {
    store.insert('order_items', {
      id: uuidv4(),
      order_id: orderId,
      sku_code: item.sku_code,
      product_name: item.product_name,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      tax_code: item.tax_code || null,
      category_code: item.category_code || null,
      weight_kg: item.weight_kg || 0,
      created_at: now
    });
  });

  recordCheckpoint(
    orderId,
    CHECKPOINT_TYPE.DOCUMENT,
    CHECKPOINT_STATUS.PENDING,
    false,
    { message: '等待证件校验' },
    idempotentKey,
    created_by || 'system'
  );

  updateOrderStatus(orderId, ORDER_STATUS.DOCS_PENDING, '订单导入完成，等待证件校验', null, created_by || 'system');

  const savedOrder = getOrderById(orderId);
  const orderItems = getOrderItems(orderId);

  res.json({
    success: true,
    message: '订单导入成功',
    data: {
      order_id: orderId,
      order_no: savedOrder.order_no,
      status: savedOrder.status,
      created_at: savedOrder.created_at,
      items: orderItems
    }
  });
});

router.get('/', (req, res) => {
  const { status, warehouse_code, start_date, end_date, page = 1, page_size = 20 } = req.query;
  
  let orders = store.findMany('orders');
  
  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (warehouse_code) {
    orders = orders.filter(o => o.warehouse_code === warehouse_code);
  }
  if (start_date) {
    orders = orders.filter(o => o.created_at >= start_date);
  }
  if (end_date) {
    orders = orders.filter(o => o.created_at <= end_date);
  }
  
  orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const pageNum = Number(page);
  const pageSize = Number(page_size);
  const startIndex = (pageNum - 1) * pageSize;
  const pagedOrders = orders.slice(startIndex, startIndex + pageSize);
  
  res.json({
    success: true,
    data: {
      orders: pagedOrders,
      pagination: { page: pageNum, page_size: pageSize, total: orders.length }
    }
  });
});

router.get('/:orderNo', (req, res) => {
  const order = getOrderByNo(req.params.orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const items = getOrderItems(order.id);
  const documents = getOrderDocuments(order.id);
  const checkpoints = getOrderCheckpoints(order.id);
  const supplements = getOrderSupplements(order.id);
  const statusHistory = getOrderStatusHistory(order.id);
  const manualCorrections = getOrderManualCorrections(order.id);

  const latestFailedCheckpoint = checkpoints
    .filter(c => c.passed === 0)
    .sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at))[0];

  const riskAssessment = {
    level: 'low',
    issues: [],
    canShip: false
  };

  if (order.status === ORDER_STATUS.SUPPLEMENT_PENDING) {
    riskAssessment.level = 'medium';
    riskAssessment.issues.push('补件处理中');
  } else if (order.status === ORDER_STATUS.PRECHECK_FAILED || order.status === ORDER_STATUS.SUPPLEMENT_TIMEOUT) {
    riskAssessment.level = 'high';
    riskAssessment.issues.push('清关预检失败或补件超时');
  }

  if (order.status === ORDER_STATUS.APPROVED) {
    riskAssessment.canShip = true;
  }

  res.json({
    success: true,
    data: {
      order,
      items,
      documents,
      checkpoints,
      supplements,
      status_history: statusHistory,
      manual_corrections: manualCorrections,
      latest_failure: latestFailedCheckpoint ? {
        error_code: latestFailedCheckpoint.error_code,
        error_message: latestFailedCheckpoint.error_message,
        failed_at: latestFailedCheckpoint.executed_at
      } : null,
      risk_assessment: riskAssessment
    }
  });
});

module.exports = router;
