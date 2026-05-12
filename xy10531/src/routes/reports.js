const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const store = require('../config/store');
const { ORDER_STATUS, SUPPLEMENT_STATUS } = require('../config/constants');
const {
  getOrderByNo,
  getOrderStatusHistory,
  getOrderCheckpoints,
  getOrderSupplements,
  getOrderManualCorrections
} = require('../services/orderService');

router.get('/statistics', (req, res) => {
  const { start_date, end_date, warehouse_code } = req.query;

  let allOrders = store.findMany('orders');

  if (warehouse_code) {
    allOrders = allOrders.filter(o => o.warehouse_code === warehouse_code);
  }
  if (start_date) {
    allOrders = allOrders.filter(o => o.created_at >= start_date);
  }
  if (end_date) {
    allOrders = allOrders.filter(o => o.created_at <= end_date);
  }

  const statusStats = {};
  Object.values(ORDER_STATUS).forEach(status => {
    statusStats[status] = 0;
  });
  allOrders.forEach(order => {
    if (statusStats[order.status] !== undefined) {
      statusStats[order.status]++;
    }
  });

  const allSupplements = store.findMany('supplements');
  const supplementStats = {
    total_supplements: allSupplements.length,
    by_reason: {},
    timeout_count: 0
  };

  allSupplements.forEach(s => {
    supplementStats.by_reason[s.reason_code] = (supplementStats.by_reason[s.reason_code] || 0) + 1;
    if (s.status === SUPPLEMENT_STATUS.TIMEOUT) {
      supplementStats.timeout_count++;
    }
  });

  const riskOrders = allOrders.filter(o => 
    [ORDER_STATUS.PRECHECK_FAILED, ORDER_STATUS.SUPPLEMENT_TIMEOUT, ORDER_STATUS.REJECTED].includes(o.status)
  );

  res.json({
    success: true,
    data: {
      total_orders: allOrders.length,
      status_distribution: statusStats,
      supplement_stats: supplementStats,
      risk_orders_count: riskOrders.length,
      risk_orders: riskOrders.map(o => ({
        order_no: o.order_no,
        status: o.status,
        created_at: o.created_at
      }))
    }
  });
});

router.get('/export', (req, res) => {
  const { format = 'json', start_date, end_date, status } = req.query;

  let orders = store.findMany('orders');

  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (start_date) {
    orders = orders.filter(o => o.created_at >= start_date);
  }
  if (end_date) {
    orders = orders.filter(o => o.created_at <= end_date);
  }

  orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const reportData = orders.map(order => {
    const checkpoints = store.findMany('checkpoints', c => c.order_id === order.id)
      .sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
    const supplements = store.findMany('supplements', s => s.order_id === order.id)
      .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    const latestFail = checkpoints.find(c => c.passed === 0);
    
    return {
      order_no: order.order_no,
      warehouse_code: order.warehouse_code,
      destination_country: order.destination_country,
      receiver_name: order.receiver_name,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      latest_failure: latestFail ? {
        type: latestFail.checkpoint_type,
        error: latestFail.error_message,
        time: latestFail.executed_at
      } : null,
      supplement_count: supplements.length,
      supplements: supplements.map(s => ({
        supplement_no: s.supplement_no,
        reason: s.reason_text,
        status: s.status,
        attempt: s.attempt_no
      }))
    };
  });

  if (format === 'csv') {
    const headers = ['订单号', '仓库', '目的国', '收件人', '状态', '金额', '创建时间', '最近失败原因', '补件次数'];
    const rows = reportData.map(r => [
      r.order_no,
      r.warehouse_code,
      r.destination_country,
      r.receiver_name,
      r.status,
      r.total_amount,
      r.created_at,
      r.latest_failure ? r.latest_failure.error : '',
      r.supplement_count
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=customs_report_${dayjs().format('YYYYMMDD')}.csv`);
    res.send('\uFEFF' + csv);
  } else {
    res.json({
      success: true,
      data: {
        report_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        total_count: reportData.length,
        orders: reportData
      }
    });
  }
});

router.get('/:orderNo/history', (req, res) => {
  const order = getOrderByNo(req.params.orderNo);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const history = getOrderStatusHistory(order.id);
  const checkpoints = getOrderCheckpoints(order.id);
  const supplements = getOrderSupplements(order.id);
  const corrections = getOrderManualCorrections(order.id);

  const timeline = [
    ...history.map(h => ({
      type: 'status_change',
      time: h.changed_at,
      actor: h.changed_by,
      from: h.from_status,
      to: h.to_status,
      reason: h.reason
    })),
    ...checkpoints.map(c => ({
      type: 'checkpoint',
      time: c.executed_at,
      actor: c.executed_by,
      checkpoint_type: c.checkpoint_type,
      passed: c.passed === 1,
      error: c.error_message
    })),
    ...supplements.map(s => ({
      type: 'supplement',
      time: s.requested_at,
      supplement_no: s.supplement_no,
      reason: s.reason_text,
      status: s.status,
      attempt: s.attempt_no
    })),
    ...corrections.map(c => ({
      type: 'manual_correction',
      time: c.corrected_at,
      actor: c.corrected_by,
      field: c.field_name,
      old_value: c.old_value,
      new_value: c.new_value,
      reason: c.correction_reason
    }))
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  res.json({
    success: true,
    data: {
      order_no: order.order_no,
      current_status: order.status,
      timeline
    }
  });
});

module.exports = router;
