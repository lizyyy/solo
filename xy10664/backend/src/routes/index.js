const express = require('express');
const router = express.Router();
const DepartmentService = require('../services/DepartmentService');
const OvertimeService = require('../services/OvertimeService');
const OrderService = require('../services/OrderService');
const RuleService = require('../services/RuleService');
const RefundService = require('../services/RefundService');
const BudgetService = require('../services/BudgetService');
const ExportService = require('../services/ExportService');
const LogService = require('../services/LogService');

const OPERATOR_ID = 1;
const OPERATOR_NAME = '系统管理员';

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '订餐补贴预算退款系统API运行正常' });
});

router.get('/departments', async (req, res) => {
  try {
    const departments = await DepartmentService.getAll();
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const dept = await DepartmentService.create(req.body, OPERATOR_ID, OPERATOR_NAME);
    res.json({ success: true, data: dept });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/overtimes', async (req, res) => {
  try {
    const overtimes = await OvertimeService.getAll();
    res.json({ success: true, data: overtimes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/overtimes', async (req, res) => {
  try {
    const overtime = await OvertimeService.create(req.body, OPERATOR_ID, OPERATOR_NAME);
    res.json({ success: true, data: overtime });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/overtimes/:id/approve', async (req, res) => {
  try {
    const result = await OvertimeService.approve(req.params.id, OPERATOR_ID, OPERATOR_NAME);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await OrderService.getAll();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const order = await OrderService.create(req.body, OPERATOR_ID, OPERATOR_NAME);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/rules', async (req, res) => {
  try {
    const rules = await RuleService.getAll();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/refunds', async (req, res) => {
  try {
    const refunds = await RefundService.getAll();
    res.json({ success: true, data: refunds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/refunds/:id/timeline', async (req, res) => {
  try {
    const timeline = await RefundService.getTimeline(req.params.id);
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/refunds', async (req, res) => {
  try {
    const refund = await RefundService.createRequest(req.body, OPERATOR_ID, OPERATOR_NAME);
    res.json({ success: true, data: refund });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/refunds/:id/review', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    const result = await RefundService.reviewRequest(req.params.id, OPERATOR_ID, OPERATOR_NAME, decision, comment);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/refunds/:id/reverse', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await RefundService.reverseRefund(req.params.id, OPERATOR_ID, OPERATOR_NAME, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/reversals', async (req, res) => {
  try {
    const filters = {
      operatorName: req.query.operatorName,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    const reversals = await RefundService.getReversals(filters);
    res.json({ success: true, data: reversals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/budgets', async (req, res) => {
  try {
    const budgets = await BudgetService.getAll();
    res.json({ success: true, data: budgets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const filters = {
      operatorName: req.query.operatorName,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    const logs = await LogService.getOperationLogs(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export/refund-report', async (req, res) => {
  try {
    const filters = {
      operatorName: req.query.operatorName,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    const csv = await ExportService.exportRefundReport(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=refund-report.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export/audit-log', async (req, res) => {
  try {
    const filters = {
      operatorName: req.query.operatorName,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    const csv = await ExportService.exportAuditLog(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/scenarios/normal', async (req, res) => {
  try {
    await OvertimeService.create({
      employee_id: 1,
      overtime_date: new Date().toISOString().slice(0, 10),
      start_time: '18:00',
      end_time: '21:00',
      hours: 3
    }, OPERATOR_ID, OPERATOR_NAME);
    await OvertimeService.approve(1, OPERATOR_ID, OPERATOR_NAME);
    
    const order = await OrderService.create({
      employee_id: 1,
      order_date: new Date().toISOString().slice(0, 10),
      meal_type: '晚餐',
      amount: 50,
      restaurant: '加班餐厅'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    const refund = await RefundService.createRequest({
      order_id: order.id,
      employee_id: 1,
      department_id: 1,
      amount: 50,
      reason: '正常加班餐补退款'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    res.json({ success: true, message: '场景1: 正常完成 - 已创建符合条件的退款申请并自动通过', data: refund });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/scenarios/rule-block', async (req, res) => {
  try {
    const order = await OrderService.create({
      employee_id: 2,
      order_date: new Date().toISOString().slice(0, 10),
      meal_type: '晚餐',
      amount: 150,
      restaurant: '高档餐厅'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    const refund = await RefundService.createRequest({
      order_id: order.id,
      employee_id: 2,
      department_id: 1,
      amount: 150,
      reason: '超额退款申请'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    res.json({ success: true, message: '场景2: 被规则挡住 - 订单金额超过限额被规则自动拒绝', data: refund });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/scenarios/manual-review', async (req, res) => {
  try {
    const period = new Date().toISOString().slice(0, 7);
    await BudgetService.getOrCreateBudget(2, period);
    
    for (let i = 0; i < 10; i++) {
      await BudgetService.consumeBudget(2, period, 3000, OPERATOR_ID, OPERATOR_NAME);
    }
    
    const order = await OrderService.create({
      employee_id: 3,
      order_date: new Date().toISOString().slice(0, 10),
      meal_type: '晚餐',
      amount: 80,
      restaurant: '测试餐厅'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    const refund = await RefundService.createRequest({
      order_id: order.id,
      employee_id: 3,
      department_id: 2,
      amount: 80,
      reason: '预算不足需要人工复核'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    res.json({ success: true, message: '场景3: 人工复核 - 部门预算不足，需要人工审核确认', data: refund });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/scenarios/duplicate', async (req, res) => {
  try {
    const order = await OrderService.create({
      employee_id: 1,
      order_date: new Date().toISOString().slice(0, 10),
      meal_type: '晚餐',
      amount: 50,
      restaurant: '测试餐厅'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    await RefundService.createRequest({
      order_id: order.id,
      employee_id: 1,
      department_id: 1,
      amount: 50,
      reason: '第一次退款申请'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    await RefundService.createRequest({
      order_id: order.id,
      employee_id: 1,
      department_id: 1,
      amount: 50,
      reason: '重复提交的退款申请'
    }, OPERATOR_ID, OPERATOR_NAME);
    
    res.json({ success: true, message: '场景4: 重复提交 - 第二次退款申请被拒绝，因为该订单已有正在处理的申请' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
