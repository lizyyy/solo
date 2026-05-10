const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const express = require('express');
const cors = require('cors');

const { initDatabase } = require('./config/database');
const planService = require('./services/planService');
const settlementService = require('./services/settlementService');
const reportService = require('./services/reportService');
const taskService = require('./services/taskService');
const {
  formatCurrency,
  getMealTypeLabel,
  getSettlementStatusLabel,
  getWorkflowStepLabel
} = require('./utils/common');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function successResponse(data, message) {
  return {
    success: true,
    message: message || '操作成功',
    data: data
  };
}

function errorResponse(message, status = 400) {
  return {
    success: false,
    message: message,
    data: null
  };
}

function formatBusinessResponse(detail) {
  const summary = detail.summary;
  
  return {
    cycleInfo: {
      period: `${detail.cycle.cycle_year}年${detail.cycle.cycle_month}月`,
      status: getSettlementStatusLabel(detail.cycle.status)
    },
    summary: {
      plannedCount: summary.plannedCount,
      verifiedCount: summary.verifiedCount,
      differenceCount: summary.differenceCount,
      plannedCountText: `订餐 ${summary.plannedCount} 份`,
      verifiedCountText: `取餐 ${summary.verifiedCount} 份`,
      differenceCountText: `差异 ${summary.differenceCount} 份`,
      plannedAmount: summary.plannedAmount,
      subsidyAmount: summary.subsidyAmount,
      actualAmount: summary.actualAmount,
      differenceAmount: summary.differenceAmount,
      plannedAmountText: formatCurrency(summary.plannedAmount),
      subsidyAmountText: formatCurrency(summary.subsidyAmount),
      actualAmountText: formatCurrency(summary.actualAmount),
      differenceAmountText: formatCurrency(summary.differenceAmount)
    },
    currentStep: detail.currentStep ? {
      code: detail.currentStep.step_code,
      name: getWorkflowStepLabel(detail.currentStep.step_code),
      status: detail.currentStep.status,
      rejectionReason: detail.currentStep.rejection_reason
    } : null,
    previousProcessing: detail.previousProcessing.map(h => ({
      stepName: getWorkflowStepLabel(h.step_code),
      action: h.action,
      time: h.processed_at,
      note: h.note
    })),
    records: detail.records.map(r => ({
      date: r.plan_date,
      mealType: r.meal_type,
      mealTypeLabel: getMealTypeLabel(r.meal_type),
      plannedCount: r.planned_count,
      verifiedCount: r.verified_count,
      plannedAmount: r.planned_amount,
      plannedAmountText: formatCurrency(r.planned_amount),
      actualAmount: r.actual_amount,
      actualAmountText: formatCurrency(r.actual_amount),
      subsidyAmount: r.subsidy_amount,
      subsidyAmountText: formatCurrency(r.subsidy_amount),
      differenceAmount: r.difference_amount,
      differenceAmountText: formatCurrency(r.difference_amount),
      differenceReason: r.difference_reason
    }))
  };
}

app.get('/api/health', (req, res) => {
  res.json(successResponse({ status: 'ok' }, '服务正常运行'));
});

app.get('/api/organizations', (req, res) => {
  const orgs = planService.listOrganizations();
  res.json(successResponse(orgs));
});

app.post('/api/organizations', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json(errorResponse('请提供组织名称'));
  }
  const org = planService.createOrganization(name);
  res.json(successResponse(org, `组织 "${org.name}" 创建成功`));
});

app.get('/api/organizations/:orgId/employees', (req, res) => {
  const emps = planService.listEmployees(req.params.orgId);
  res.json(successResponse(emps));
});

app.get('/api/organizations/:orgId/plans', (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json(errorResponse('请提供年份和月份'));
  }
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);
  const plans = planService.listMealPlans(req.params.orgId, startDate, endDate);
  
  const plansWithVerify = plans.map(p => ({
    ...p,
    verifiedCount: planService.getVerificationCountByPlan(p.id),
    mealTypeLabel: getMealTypeLabel(p.meal_type)
  }));
  
  res.json(successResponse(plansWithVerify));
});

app.get('/api/organizations/:orgId/subsidy-rules', (req, res) => {
  const rules = planService.listAllSubsidyRules(req.params.orgId);
  res.json(successResponse(rules));
});

app.post('/api/organizations/:orgId/settlement-cycles', (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) {
    return res.status(400).json(errorResponse('请提供年份和月份'));
  }
  const cycle = settlementService.createSettlementCycle(req.params.orgId, parseInt(year), parseInt(month));
  res.json(successResponse(cycle, `${year}年${month}月结算周期创建成功`));
});

app.get('/api/organizations/:orgId/settlement-cycles', (req, res) => {
  const cycles = settlementService.listSettlementCycles(req.params.orgId);
  const cyclesWithLabel = cycles.map(c => ({
    ...c,
    statusLabel: getSettlementStatusLabel(c.status),
    differenceAmountText: formatCurrency(c.total_difference_amount)
  }));
  res.json(successResponse(cyclesWithLabel));
});

app.get('/api/settlement-cycles/:cycleId', (req, res) => {
  const detail = settlementService.getSettlementDetail(req.params.cycleId);
  if (!detail) {
    return res.status(404).json(errorResponse('结算周期不存在'));
  }
  res.json(successResponse(formatBusinessResponse(detail)));
});

app.get('/api/settlement-cycles/:cycleId/steps', (req, res) => {
  const steps = settlementService.getWorkflowSteps(req.params.cycleId);
  const stepsWithLabel = steps.map(s => ({
    ...s,
    stepNameLabel: getWorkflowStepLabel(s.step_code),
    isCurrent: s.status === 'in_progress' || s.status === 'rejected'
  }));
  res.json(successResponse(stepsWithLabel));
});

app.get('/api/settlement-cycles/:cycleId/status', (req, res) => {
  const detail = settlementService.getSettlementDetail(req.params.cycleId);
  if (!detail) {
    return res.status(404).json(errorResponse('结算周期不存在'));
  }
  
  const currentStep = detail.currentStep;
  const response = {
    status: getSettlementStatusLabel(detail.cycle.status),
    currentStep: currentStep ? {
      name: getWorkflowStepLabel(currentStep.step_code),
      code: currentStep.step_code,
      status: currentStep.status,
      rejectionReason: currentStep.rejection_reason,
      handler: currentStep.handler_name
    } : null,
    history: detail.previousProcessing.map(h => ({
      step: getWorkflowStepLabel(h.step_code),
      action: h.action,
      time: h.processed_at,
      note: h.note
    }))
  };
  
  res.json(successResponse(response));
});

app.post('/api/settlement-cycles/:cycleId/calculate', (req, res) => {
  try {
    const detail = settlementService.calculateSettlement(req.params.cycleId);
    res.json(successResponse(formatBusinessResponse(detail), '结算差异计算完成'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/submit', (req, res) => {
  try {
    const { handlerRole, handlerId, handlerName } = req.body;
    const detail = settlementService.submitForReview(
      req.params.cycleId, handlerRole, handlerId, handlerName
    );
    res.json(successResponse(formatBusinessResponse(detail), '已提交审核'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/review', (req, res) => {
  try {
    const { stepCode, approved, reason, handlerRole, handlerId, handlerName } = req.body;
    const detail = settlementService.reviewStep(
      req.params.cycleId, stepCode, approved, reason, handlerRole, handlerId, handlerName
    );
    res.json(successResponse(formatBusinessResponse(detail), approved ? '审核通过' : '审核驳回'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/resubmit', (req, res) => {
  try {
    const { handlerRole, handlerId, handlerName } = req.body;
    const detail = settlementService.resubmitAfterRejection(
      req.params.cycleId, null, handlerRole, handlerId, handlerName
    );
    res.json(successResponse(formatBusinessResponse(detail), '已重新提交'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/adjustments', (req, res) => {
  try {
    const { recordId, adjustmentType, amount, reason, operatorId, operatorName } = req.body;
    const adj = settlementService.createAdjustment(
      req.params.cycleId, recordId, adjustmentType, amount, reason, operatorId, operatorName
    );
    res.json(successResponse(adj, '调整记录创建成功，等待审批'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.get('/api/settlement-cycles/:cycleId/adjustments', (req, res) => {
  const adjustments = settlementService.listAdjustments(req.params.cycleId);
  res.json(successResponse(adjustments));
});

app.post('/api/adjustments/:adjustId/approve', (req, res) => {
  try {
    const { approved } = req.body;
    const adj = settlementService.approveAdjustment(req.params.adjustId, approved !== false);
    res.json(successResponse(adj, approved !== false ? '调整审批通过' : '调整审批驳回'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/finalize', (req, res) => {
  try {
    const { handlerRole, handlerId, handlerName } = req.body;
    const detail = settlementService.finalSettlement(
      req.params.cycleId, handlerRole, handlerId, handlerName
    );
    res.json(successResponse(formatBusinessResponse(detail), '结算完成'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/settlement-cycles/:cycleId/report', (req, res) => {
  try {
    const result = reportService.generateSettlementReport(req.params.cycleId);
    res.json(successResponse({
      reportId: result.id,
      formattedText: result.formattedText,
      data: result.report
    }, '报表生成成功'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.get('/api/settlement-cycles/:cycleId/reports', (req, res) => {
  const reports = reportService.listReports(req.params.cycleId);
  res.json(successResponse(reports));
});

app.post('/api/tasks', (req, res) => {
  const { taskType, taskName, payload, settlementCycleId } = req.body;
  const task = taskService.createTask(taskType, taskName, payload, settlementCycleId);
  res.json(successResponse(task, '任务创建成功'));
});

app.get('/api/tasks', (req, res) => {
  const { status } = req.query;
  const tasks = taskService.listTasks(status);
  res.json(successResponse(tasks));
});

app.get('/api/tasks/:taskId', (req, res) => {
  const task = taskService.getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json(errorResponse('任务不存在'));
  }
  const statusDesc = taskService.getTaskStatusDescription(task);
  res.json(successResponse({
    task: task,
    status: statusDesc
  }));
});

app.post('/api/tasks/:taskId/execute', (req, res) => {
  try {
    const result = taskService.executeTask(req.params.taskId);
    res.json(successResponse(result, result.message));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/tasks/:taskId/retry', (req, res) => {
  try {
    const task = taskService.retryTask(req.params.taskId);
    res.json(successResponse(task, '任务已重置，可以重新执行'));
  } catch (err) {
    res.status(400).json(errorResponse(err.message));
  }
});

app.post('/api/tasks/execute-all', (req, res) => {
  const results = taskService.executePendingTasks();
  res.json(successResponse(results, `执行了 ${results.length} 个任务`));
});

async function startServer() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`团餐结算差异 API 服务已启动`);
    console.log(`端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('主要接口:');
    console.log('  GET  /api/organizations               - 组织列表');
    console.log('  POST /api/organizations/:orgId/settlement-cycles - 创建结算周期');
    console.log('  POST /api/settlement-cycles/:cycleId/calculate   - 计算差异');
    console.log('  GET  /api/settlement-cycles/:cycleId/status      - 查看当前卡点');
    console.log('  POST /api/settlement-cycles/:cycleId/report      - 生成报表');
  });
}

startServer();
