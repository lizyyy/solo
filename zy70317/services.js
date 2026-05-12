const models = require('./models');
const { OrderStatus, DiffType, DiffStatus, TaskStatus } = models;

const createBusinessOrder = async (orderNo, amount) => {
  const existing = await models.getOrder(orderNo);
  if (existing) {
    throw new Error(`订单 ${orderNo} 已存在`);
  }
  return models.createOrder(orderNo, amount);
};

const simulatePaymentComplete = async (orderNo) => {
  const order = await models.getOrder(orderNo);
  if (!order) {
    throw new Error(`订单 ${orderNo} 不存在`);
  }
  if (order.status === OrderStatus.CANCELLED) {
    throw new Error(`订单 ${orderNo} 已取消，无法支付`);
  }
  await models.markOrderPaid(orderNo);
  return models.getOrder(orderNo);
};

const writeAccountingFlow = async (orderNo, amount, flowNo = null) => {
  const order = await models.getOrder(orderNo);
  if (!order) {
    throw new Error(`订单 ${orderNo} 不存在`);
  }
  return models.createAccountingFlow(orderNo, amount, flowNo);
};

const runReconciliationScan = async () => {
  const paidOrders = await models.getPaidOrders();
  let matchedCount = 0;
  let diffCount = 0;
  const diffs = [];
  
  const scan = await models.createReconciliationScan(paidOrders.length, 0, 0);
  
  for (const order of paidOrders) {
    const flows = await models.getFlowsByOrderNo(order.order_no);
    
    if (flows.length === 0) {
      diffCount++;
      const diff = await models.createReconciliationDiff(
        scan.id,
        DiffType.MISSING_FLOW,
        order.order_no,
        order.amount,
        null,
        '订单已完成支付，但未找到对应账务流水'
      );
      diffs.push(diff);
      await models.createCompensationTask(diff.id, order.order_no, order.amount);
    } else {
      const totalFlowAmount = flows.reduce((sum, f) => sum + f.amount, 0);
      if (Math.abs(totalFlowAmount - order.amount) > 0.001) {
        diffCount++;
        const diff = await models.createReconciliationDiff(
          scan.id,
          DiffType.AMOUNT_MISMATCH,
          order.order_no,
          order.amount,
          totalFlowAmount,
          `订单金额 ${order.amount} 与账务流水总额 ${totalFlowAmount} 不一致`
        );
        diffs.push(diff);
      } else {
        matchedCount++;
      }
    }
  }
  
  const { db } = require('./database');
  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE reconciliation_scans SET matched_orders = ?, diff_orders = ? WHERE id = ?',
      [matchedCount, diffCount, scan.id],
      (err) => (err ? reject(err) : resolve())
    );
  });
  
  return {
    scan: { ...scan, matched_orders: matchedCount, diff_orders: diffCount },
    diffs
  };
};

const executeCompensation = async (taskId) => {
  const task = await models.getTask(taskId);
  if (!task) {
    throw new Error(`补偿任务 ${taskId} 不存在`);
  }
  
  const diff = await models.getDiff(task.diff_id);
  if (!diff) {
    throw new Error(`对账差异 ${task.diff_id} 不存在`);
  }
  
  const order = await models.getOrder(task.order_no);
  
  if (order.status === OrderStatus.CANCELLED) {
    await models.updateTaskStatus(taskId, TaskStatus.BLOCKED, '订单已取消，不允许补偿');
    await models.createCompensationRecord(
      taskId, task.diff_id, task.order_no, null, task.amount,
      'COMPENSATION_ATTEMPT', 'BLOCKED', '订单已取消，不允许补偿'
    );
    await models.updateDiffStatus(task.diff_id, DiffStatus.CLOSED, '订单已取消，不允许补偿');
    return {
      success: false,
      message: '订单已取消，不允许补偿',
      status: 'BLOCKED'
    };
  }
  
  const existingFlows = await models.getFlowsByOrderNo(task.order_no);
  if (existingFlows.length > 0 && diff.diff_type === DiffType.MISSING_FLOW) {
    const totalFlowAmount = existingFlows.reduce((sum, f) => sum + f.amount, 0);
    if (Math.abs(totalFlowAmount - order.amount) < 0.001) {
      await models.updateTaskStatus(taskId, TaskStatus.SUCCESS);
      await models.createCompensationRecord(
        taskId, task.diff_id, task.order_no, null, task.amount,
        'ALREADY_COMPENSATED', 'SUCCESS', '账务流水已存在，跳过补偿'
      );
      await models.updateDiffStatus(task.diff_id, DiffStatus.COMPENSATED, '账务流水已存在，差异自动关闭');
      return {
        success: true,
        message: '账务流水已存在，跳过补偿',
        status: 'ALREADY_COMPENSATED'
      };
    }
  }
  
  if (task.status === TaskStatus.SUCCESS) {
    return {
      success: true,
      message: '该补偿任务已成功执行，不允许重复补偿',
      status: 'ALREADY_SUCCESS'
    };
  }
  
  await models.updateTaskStatus(taskId, TaskStatus.PROCESSING);
  
  try {
    const flow = await models.createAccountingFlow(task.order_no, task.amount);
    
    await models.updateTaskStatus(taskId, TaskStatus.SUCCESS);
    await models.createCompensationRecord(
      taskId, task.diff_id, task.order_no, flow.flow_no, task.amount,
      'COMPENSATION', 'SUCCESS', `补偿成功，新增账务流水: ${flow.flow_no}`
    );
    await models.updateDiffStatus(task.diff_id, DiffStatus.COMPENSATED, '补偿任务执行成功');
    
    return {
      success: true,
      message: '补偿成功',
      flow_no: flow.flow_no,
      status: 'SUCCESS'
    };
  } catch (error) {
    await models.updateTaskStatus(taskId, TaskStatus.FAILED, error.message);
    await models.createCompensationRecord(
      taskId, task.diff_id, task.order_no, null, task.amount,
      'COMPENSATION_ATTEMPT', 'FAILED', `补偿失败: ${error.message}`
    );
    
    return {
      success: false,
      message: `补偿失败: ${error.message}`,
      status: 'FAILED',
      retry_allowed: true
    };
  }
};

const retryCompensation = async (taskId) => {
  const task = await models.getTask(taskId);
  if (!task) {
    throw new Error(`补偿任务 ${taskId} 不存在`);
  }
  
  if (task.status !== TaskStatus.FAILED) {
    throw new Error(`只有失败的任务才能重试，当前状态: ${task.status}`);
  }
  
  return executeCompensation(taskId);
};

const closeDiff = async (diffId, reason) => {
  const diff = await models.getDiff(diffId);
  if (!diff) {
    throw new Error(`对账差异 ${diffId} 不存在`);
  }
  
  await models.updateDiffStatus(diffId, DiffStatus.CLOSED, reason);
  
  const tasks = await models.getTasksByDiffId(diffId);
  for (const task of tasks) {
    if (task.status === TaskStatus.PENDING || task.status === TaskStatus.PROCESSING) {
      await models.updateTaskStatus(task.id, TaskStatus.BLOCKED, '对账差异已关闭');
    }
  }
  
  return models.getDiff(diffId);
};

const getDiffDetail = async (diffId) => {
  const diff = await models.getDiff(diffId);
  if (!diff) return null;
  
  const order = await models.getOrder(diff.order_no);
  const flows = await models.getFlowsByOrderNo(diff.order_no);
  const tasks = await models.getTasksByDiffId(diffId);
  const history = await models.getCompensationHistory(diffId);
  
  return {
    diff,
    order,
    current_flows: flows,
    tasks,
    compensation_history: history
  };
};

const getFinancialSummary = async () => {
  const summary = await models.getReconciliationSummary();
  const scans = await models.getScans();
  const diffs = await models.getDiffs();
  
  const pendingDiffs = diffs.filter(d => d.status === DiffStatus.PENDING || d.status === DiffStatus.NEED_REVIEW);
  
  const readableSummary = {
    overview: {
      '总已完成订单数': summary.total_paid_orders,
      '已有账务流水订单数': summary.total_flows,
      '待处理差异数': summary.pending_diffs,
      '需人工复核差异数': summary.need_review_diffs,
      '已补偿差异数': summary.compensated_diffs,
      '已关闭差异数': summary.closed_diffs,
      '待执行补偿任务数': summary.pending_tasks,
      '成功执行补偿任务数': summary.success_tasks,
      '失败补偿任务数': summary.failed_tasks
    },
    recent_scans: scans.slice(0, 5).map(s => ({
      '扫描日期': s.scan_date,
      '扫描订单数': s.total_orders,
      '匹配订单数': s.matched_orders,
      '差异订单数': s.diff_orders,
      '扫描时间': s.created_at
    })),
    pending_diffs_details: pendingDiffs.map(d => ({
      '差异ID': d.id,
      '订单号': d.order_no,
      '差异类型': d.diff_type === DiffType.MISSING_FLOW ? '缺少账务流水' : '金额不一致',
      '订单金额': d.order_amount,
      '流水金额': d.flow_amount,
      '差异金额': d.diff_amount,
      '差异原因': d.diff_reason,
      '状态': d.status,
      '创建时间': d.created_at
    }))
  };
  
  return readableSummary;
};

module.exports = {
  createBusinessOrder,
  simulatePaymentComplete,
  writeAccountingFlow,
  runReconciliationScan,
  executeCompensation,
  retryCompensation,
  closeDiff,
  getDiffDetail,
  getFinancialSummary
};
