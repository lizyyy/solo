const {
  createOrderCalendar,
  updateOrderCalendar,
  getOrderCalendarById,
  getOrderCalendarList,
  batchImportOrders,
  detectConflicts,
  TABLE_NAME,
} = require('../models/orderCalendar');
const { createBatch, updateBatchStats } = require('../models/batch');
const { getWorkflowHistory } = require('../utils/workflow');
const { getChangeHistory } = require('../utils/audit');
const { maskSensitiveData } = require('../utils/export');
const config = require('../config');

function createOrder(req, res) {
  try {
    const order = createOrderCalendar(req.body, req.user);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const { change_reason, ...data } = req.body;
    const order = updateOrderCalendar(id, data, req.user, change_reason || '更新订单');
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getOrder(req, res) {
  try {
    const { id } = req.params;
    let order = getOrderCalendarById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    order = maskSensitiveData(order, req.user.role);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listOrders(req, res) {
  try {
    let orders = getOrderCalendarList(req.query);
    orders = orders.map(o => maskSensitiveData(o, req.user.role));
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function importOrders(req, res) {
  try {
    const { orders, merge_strategy } = req.body;
    const mergeStrategy = merge_strategy || config.mergeStrategy.APPEND;
    
    const batch = createBatch('order_calendar', req.user, mergeStrategy);
    
    const results = batchImportOrders(orders, req.user, mergeStrategy);
    
    updateBatchStats(batch.id, results.total, results.success, results.failed);
    
    res.json({
      success: true,
      data: {
        batch_id: batch.id,
        batch_no: batch.batch_no,
        ...results,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getOrderHistory(req, res) {
  try {
    const { id } = req.params;
    const history = getChangeHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getOrderWorkflow(req, res) {
  try {
    const { id } = req.params;
    const history = getWorkflowHistory(TABLE_NAME, id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function getOrderConflicts(req, res) {
  try {
    const conflicts = detectConflicts();
    res.json({ success: true, data: conflicts });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  createOrder,
  updateOrder,
  getOrder,
  listOrders,
  importOrders,
  getOrderHistory,
  getOrderWorkflow,
  getOrderConflicts,
};
