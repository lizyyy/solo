const express = require('express');
const studentService = require('../services/studentService');
const deductionService = require('../services/deductionService');
const arrearService = require('../services/arrearService');
const installmentService = require('../services/installmentService');
const approvalService = require('../services/approvalService');
const paymentService = require('../services/paymentService');
const compensationService = require('../services/compensationService');

const router = express.Router();

router.use(express.json());

router.post('/students', (req, res) => {
  try {
    const student = studentService.createStudent(req.body);
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/students', (req, res) => {
  const students = studentService.getAllStudents();
  res.json({ success: true, data: students });
});

router.get('/students/:id', (req, res) => {
  const student = studentService.getStudent(parseInt(req.params.id));
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }
  res.json({ success: true, data: student });
});

router.post('/deduction-rules', (req, res) => {
  try {
    const rule = deductionService.createDeductionRule(req.body);
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/deduction-rules', (req, res) => {
  const rules = deductionService.getDeductionRules();
  res.json({ success: true, data: rules });
});

router.post('/arrears', (req, res) => {
  try {
    const arrear = arrearService.createArrearRecord(req.body);
    res.json({ success: true, data: arrear });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/arrears/student/:studentId', (req, res) => {
  const arrears = arrearService.getStudentArrears(parseInt(req.params.studentId));
  res.json({ success: true, data: arrears });
});

router.get('/arrears/:id/summary', (req, res) => {
  try {
    const summary = arrearService.getArrearSummary(parseInt(req.params.id));
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/arrears/:id/apply-deductions', (req, res) => {
  try {
    const result = arrearService.calculateAndApplyDeductions(
      parseInt(req.params.id),
      req.body.deductions
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/arrears/:id/freeze', (req, res) => {
  try {
    const result = arrearService.freezeArrear(
      parseInt(req.params.id),
      req.body.reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/arrears/:id/unfreeze', (req, res) => {
  try {
    const result = arrearService.unfreezeArrear(parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/installment-plans', (req, res) => {
  try {
    const plan = installmentService.createInstallmentPlan(req.body);
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/installment-plans/:id', (req, res) => {
  const plan = installmentService.getInstallmentPlan(parseInt(req.params.id));
  if (!plan) {
    return res.status(404).json({ success: false, error: '分期计划不存在' });
  }
  res.json({ success: true, data: plan });
});

router.post('/installment-plans/:id/pay', (req, res) => {
  try {
    const result = installmentService.payInstallment(
      parseInt(req.params.id),
      req.body.period,
      req.body.amount
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/installment-plans/overdue', (req, res) => {
  const overdue = installmentService.getOverdueInstallments();
  res.json({ success: true, data: overdue });
});

router.post('/approvals', (req, res) => {
  try {
    const process = approvalService.createApprovalProcess(req.body);
    res.json({ success: true, data: process });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/approvals/:id/approve', (req, res) => {
  try {
    const result = approvalService.approve(
      parseInt(req.params.id),
      req.body.approver,
      req.body.remark
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/approvals/:id/reject', (req, res) => {
  try {
    const result = approvalService.reject(
      parseInt(req.params.id),
      req.body.approver,
      req.body.reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/approvals/pending', (req, res) => {
  const pending = approvalService.getPendingApprovals();
  res.json({ success: true, data: pending });
});

router.post('/payments', (req, res) => {
  try {
    const payment = paymentService.recordPayment(req.body);
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/payments/callback', (req, res) => {
  try {
    const result = paymentService.handlePaymentCallback(
      req.body.orderNo,
      req.body.callbackData
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/payments/:orderNo', (req, res) => {
  const payment = paymentService.getPaymentRecord(req.params.orderNo);
  if (!payment) {
    return res.status(404).json({ success: false, error: '支付记录不存在' });
  }
  res.json({ success: true, data: payment });
});

router.post('/reconciliation', (req, res) => {
  try {
    const recon = paymentService.createReconciliation(req.body);
    res.json({ success: true, data: recon });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/reconciliation/unmatched', (req, res) => {
  const unmatched = paymentService.getUnmatchedPayments();
  res.json({ success: true, data: unmatched });
});

router.get('/failed-tasks', (req, res) => {
  const tasks = compensationService.getFailedTasks();
  res.json({ success: true, data: tasks });
});

router.post('/failed-tasks/:id/retry', (req, res) => {
  try {
    const result = compensationService.retryTask(parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/failed-tasks/retry-all', (req, res) => {
  const results = compensationService.retryAllFailedTasks();
  res.json({ success: true, data: results });
});

router.get('/failed-tasks/history', (req, res) => {
  const history = compensationService.getAllTaskHistory();
  res.json({ success: true, data: history });
});

module.exports = router;
