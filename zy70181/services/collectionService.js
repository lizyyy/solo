const { run, get, all } = require('../db/database');
const dateUtils = require('../utils/dateUtils');
const agingService = require('./agingService');
const receivableService = require('./receivableService');

function generateTaskCode() {
  const today = dateUtils.getToday().replace(/-/g, '');
  const result = get(`
    SELECT COUNT(*) as count FROM collection_tasks 
    WHERE task_code LIKE ?
  `, `CS${today}%`);
  const count = result?.count || 0;
  
  return `CS${today}${String(count + 1).padStart(4, '0')}`;
}

function createCollectionTask(data) {
  const taskCode = generateTaskCode();
  
  const aging = agingService.calculateInvoiceAging(data.invoiceId);
  if (!aging) {
    throw new Error('无法获取发票账龄信息');
  }
  
  if (aging.balance <= 0) {
    throw new Error('该发票已结清，无需催收');
  }
  
  const result = run(`
    INSERT INTO collection_tasks 
    (customer_id, invoice_id, contract_id, task_code, collection_level, 
     assigned_to, current_status, current_step, expected_amount, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    data.customerId,
    data.invoiceId || null,
    data.contractId || null,
    taskCode,
    aging.collectionLevel,
    data.assignedTo,
    'pending',
    'initiate',
    aging.balance,
    data.priority || 'normal'
  );
  
  const taskId = result.lastInsertRowid;
  
  addWorkflowStep({
    taskId,
    stepName: 'initiate',
    action: '发起任务',
    operator: data.assignedTo,
    status: 'completed',
    comment: `任务创建，账龄${aging.overdueDays}天，余额${aging.balance.toFixed(2)}元`
  });
  
  return { taskId, taskCode };
}

function addWorkflowStep(data) {
  const { taskId, stepName, action, operator, status, comment } = data;
  
  const maxOrderResult = get(`
    SELECT MAX(step_order) as max_order FROM task_workflow WHERE task_id = ?
  `, taskId);
  const maxOrder = maxOrderResult?.max_order || 0;
  
  return run(`
    INSERT INTO task_workflow 
    (task_id, step_order, step_name, action, operator, status, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, taskId, maxOrder + 1, stepName, action, operator, status, comment || null);
}

function getTaskDetail(taskId) {
  const task = get(`
    SELECT ct.*, c.name as customer_name, c.code as customer_code,
           i.invoice_no, i.invoice_date, i.due_date, i.amount,
           ct.contract_id, ct2.contract_no, ct2.contract_name
    FROM collection_tasks ct
    LEFT JOIN customers c ON ct.customer_id = c.id
    LEFT JOIN invoices i ON ct.invoice_id = i.id
    LEFT JOIN contracts ct2 ON ct.contract_id = ct2.id
    WHERE ct.id = ?
  `, taskId);
  
  if (!task) return null;
  
  const workflow = all(`
    SELECT * FROM task_workflow WHERE task_id = ? ORDER BY step_order ASC
  `, taskId);
  
  const currentStepInfo = agingService.getWorkflowStep(task.current_step);
  
  const blockPoint = findBlockPoint(taskId);
  
  const lastRejectRecord = findLastReject(taskId);
  
  const invoiceBalance = task.invoice_id ? receivableService.getInvoiceBalance(task.invoice_id) : task.expected_amount;
  
  return {
    ...task,
    currentStepInfo,
    workflow,
    blockPoint,
    lastRejectRecord,
    currentBalance: invoiceBalance
  };
}

function findBlockPoint(taskId) {
  const workflow = all(`
    SELECT * FROM task_workflow 
    WHERE task_id = ? 
    ORDER BY step_order DESC
  `, taskId);
  
  for (const step of workflow) {
    if (step.status === 'rejected') {
      return {
        stepName: step.step_name,
        stepOrder: step.step_order,
        action: step.action,
        operator: step.operator,
        comment: step.comment,
        rejectedAt: step.created_at
      };
    }
    if (step.status === 'pending') {
      return {
        stepName: step.step_name,
        stepOrder: step.step_order,
        action: step.action,
        operator: step.operator,
        status: 'pending'
      };
    }
  }
  
  return null;
}

function findLastReject(taskId) {
  const rejectSteps = all(`
    SELECT * FROM task_workflow 
    WHERE task_id = ? AND status = 'rejected'
    ORDER BY step_order DESC
    LIMIT 1
  `, taskId);
  
  if (rejectSteps.length === 0) return null;
  
  const rejectStep = rejectSteps[0];
  
  const previousStep = get(`
    SELECT * FROM task_workflow 
    WHERE task_id = ? AND step_order < ?
    ORDER BY step_order DESC
    LIMIT 1
  `, taskId, rejectStep.step_order);
  
  return {
    reject: rejectStep,
    previousAction: previousStep || null
  };
}

function advanceTask(data) {
  const { taskId, operator, comment } = data;
  
  const task = get('SELECT * FROM collection_tasks WHERE id = ?', taskId);
  if (!task) throw new Error('任务不存在');
  
  const currentStep = agingService.getWorkflowStep(task.current_step);
  if (!currentStep) throw new Error('当前步骤无效');
  
  if (!currentStep.next) {
    throw new Error('任务已完成，无法继续推进');
  }
  
  addWorkflowStep({
    taskId,
    stepName: currentStep.next,
    action: `推进到${agingService.getWorkflowStep(currentStep.next).name}`,
    operator,
    status: 'completed',
    comment: comment || '正常推进'
  });
  
  const isFinalStep = !agingService.getWorkflowStep(currentStep.next).next;
  
  run(`
    UPDATE collection_tasks 
    SET current_step = ?, 
        current_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    currentStep.next,
    isFinalStep ? 'completed' : 'in_progress',
    taskId
  );
  
  return getTaskDetail(taskId);
}

function rejectTask(data) {
  const { taskId, operator, reason } = data;
  
  const task = get('SELECT * FROM collection_tasks WHERE id = ?', taskId);
  if (!task) throw new Error('任务不存在');
  
  const currentStep = agingService.getWorkflowStep(task.current_step);
  if (!currentStep || !currentStep.canReject) {
    throw new Error('当前步骤不允许拒绝');
  }
  
  addWorkflowStep({
    taskId,
    stepName: task.current_step,
    action: '退回修改',
    operator,
    status: 'rejected',
    comment: reason
  });
  
  run(`
    UPDATE collection_tasks 
    SET reject_count = reject_count + 1,
        last_reject_reason = ?,
        current_status = 'rejected',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, reason, taskId);
  
  return getTaskDetail(taskId);
}

function restartTaskAfterReject(data) {
  const { taskId, operator, comment } = data;
  
  const task = get('SELECT * FROM collection_tasks WHERE id = ?', taskId);
  if (!task) throw new Error('任务不存在');
  
  if (task.current_status !== 'rejected') {
    throw new Error('只有被拒绝的任务才能重新提交');
  }
  
  addWorkflowStep({
    taskId,
    stepName: task.current_step,
    action: '重新提交',
    operator,
    status: 'completed',
    comment: comment || '修改后重新提交'
  });
  
  run(`
    UPDATE collection_tasks 
    SET current_status = 'in_progress',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, taskId);
  
  return getTaskDetail(taskId);
}

function getCollectionTasks(status = null, customerId = null) {
  let query = `
    SELECT ct.*, c.name as customer_name, c.code as customer_code,
           i.invoice_no, i.due_date, i.amount
    FROM collection_tasks ct
    LEFT JOIN customers c ON ct.customer_id = c.id
    LEFT JOIN invoices i ON ct.invoice_id = i.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND ct.current_status = ?';
    params.push(status);
  }
  
  if (customerId) {
    query += ' AND ct.customer_id = ?';
    params.push(customerId);
  }
  
  query += ' ORDER BY ct.created_at DESC';
  
  return all(query, ...params);
}

function getTasksWithBlockPoints() {
  const tasks = all(`
    SELECT ct.*, c.name as customer_name, i.invoice_no
    FROM collection_tasks ct
    LEFT JOIN customers c ON ct.customer_id = c.id
    LEFT JOIN invoices i ON ct.invoice_id = i.id
    WHERE ct.current_status != 'completed'
    ORDER BY ct.updated_at DESC
  `);
  
  return tasks.map(task => {
    const detail = getTaskDetail(task.id);
    return {
      id: task.id,
      taskCode: task.task_code,
      customerName: task.customer_name,
      invoiceNo: task.invoice_no,
      collectionLevel: task.collection_level,
      currentStatus: task.current_status,
      currentStep: task.current_step,
      rejectCount: task.reject_count,
      blockPoint: detail?.blockPoint,
      lastRejectReason: task.last_reject_reason,
      lastRejectRecord: detail?.lastRejectRecord
    };
  });
}

function recordPaymentPromise(data) {
  const { taskId, customerId, invoiceId, promisedAmount, promisedDate, remark } = data;
  
  const result = run(`
    INSERT INTO payment_promises 
    (task_id, customer_id, invoice_id, promised_amount, promised_date, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `, taskId, customerId, invoiceId || null, promisedAmount, promisedDate, remark || null);
  
  addWorkflowStep({
    taskId,
    stepName: 'execute',
    action: '记录承诺回款',
    operator: 'system',
    status: 'completed',
    comment: `客户承诺于${promisedDate}回款${promisedAmount.toFixed(2)}元`
  });
  
  return result;
}

function getPaymentPromises(taskId = null, customerId = null) {
  let query = `
    SELECT pp.*, c.name as customer_name, i.invoice_no, ct.task_code
    FROM payment_promises pp
    LEFT JOIN customers c ON pp.customer_id = c.id
    LEFT JOIN invoices i ON pp.invoice_id = i.id
    LEFT JOIN collection_tasks ct ON pp.task_id = ct.id
    WHERE 1=1
  `;
  const params = [];
  
  if (taskId) {
    query += ' AND pp.task_id = ?';
    params.push(taskId);
  }
  
  if (customerId) {
    query += ' AND pp.customer_id = ?';
    params.push(customerId);
  }
  
  query += ' ORDER BY pp.promised_date DESC';
  
  return all(query, ...params);
}

function fulfillPromise(promiseId, actualDate = null) {
  const promise = get('SELECT * FROM payment_promises WHERE id = ?', promiseId);
  if (!promise) throw new Error('承诺记录不存在');
  
  const paymentDate = actualDate || dateUtils.getToday();
  
  run(`
    UPDATE payment_promises 
    SET actual_payment_date = ?, is_fulfilled = 1
    WHERE id = ?
  `, paymentDate, promiseId);
  
  if (promise.task_id) {
    addWorkflowStep({
      taskId: promise.task_id,
      stepName: 'followup',
      action: '承诺回款兑现',
      operator: 'system',
      status: 'completed',
      comment: `承诺回款${promise.promised_amount.toFixed(2)}元已于${paymentDate}兑现`
    });
  }
  
  return { promiseId, actualDate: paymentDate };
}

function markBadDebt(data) {
  const { invoiceId, customerId, badDebtAmount, reason, approvedBy } = data;
  
  const balance = receivableService.getInvoiceBalance(invoiceId);
  if (balance <= 0) {
    throw new Error('该发票已结清，无法标记坏账');
  }
  
  if (badDebtAmount > balance) {
    throw new Error('坏账金额不能超过发票余额');
  }
  
  return run(`
    INSERT INTO bad_debt_records 
    (customer_id, invoice_id, bad_debt_amount, reason, approved_by, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `, customerId, invoiceId, badDebtAmount, reason, approvedBy || null);
}

function approveBadDebt(badDebtId, operator) {
  const badDebt = get('SELECT * FROM bad_debt_records WHERE id = ?', badDebtId);
  if (!badDebt) throw new Error('坏账记录不存在');
  
  const approveDate = dateUtils.getToday();
  
  run(`
    UPDATE bad_debt_records 
    SET status = 'approved', approved_by = ?, approved_date = ?
    WHERE id = ?
  `, operator, approveDate, badDebtId);
  
  receivableService.addReceivableLedgerEntry({
    customerId: badDebt.customer_id,
    contractId: null,
    invoiceId: badDebt.invoice_id,
    ledgerType: 'bad_debt',
    amount: -badDebt.bad_debt_amount,
    balance: 0,
    dueDate: null,
    transactionDate: approveDate,
    referenceNo: `BD${String(badDebtId).padStart(6, '0')}`,
    remark: `坏账核销，原因：${badDebt.reason}`
  });
  
  return { badDebtId, status: 'approved', approveDate };
}

function getBadDebtRecords(status = null) {
  let query = `
    SELECT bdr.*, c.name as customer_name, i.invoice_no, i.invoice_date
    FROM bad_debt_records bdr
    LEFT JOIN customers c ON bdr.customer_id = c.id
    LEFT JOIN invoices i ON bdr.invoice_id = i.id
  `;
  const params = [];
  
  if (status) {
    query += ' WHERE bdr.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY bdr.created_at DESC';
  
  return all(query, ...params);
}

module.exports = {
  createCollectionTask,
  getCollectionTasks,
  getTaskDetail,
  advanceTask,
  rejectTask,
  restartTaskAfterReject,
  getTasksWithBlockPoints,
  addWorkflowStep,
  recordPaymentPromise,
  getPaymentPromises,
  fulfillPromise,
  markBadDebt,
  approveBadDebt,
  getBadDebtRecords
};
