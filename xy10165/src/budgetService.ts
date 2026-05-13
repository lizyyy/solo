import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';
import { 
  getOrCreateDepartment, 
  getBudgetById, 
  getBudgetByDepartmentPeriodType,
  recordBudgetHistory,
  recordException,
  Budget,
  PurchaseRequest,
  ContractPayment
} from './models';

export interface CheckResult {
  budgetId: string;
  departmentName: string;
  period: string;
  budgetType: string;
  budgetAmount: number;
  usedAmount: number;
  reservedAmount: number;
  remainingAmount: number;
  usageRate: number;
  threshold: number;
  isOverThreshold: boolean;
  isOverBudget: boolean;
  issues: string[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ImportSummary {
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
}

export interface CreatePurchaseRequestParams {
  requestNo: string;
  departmentName: string;
  itemName: string;
  requestedAmount: number;
  requestDate: string;
  requester?: string;
  description?: string;
  period?: string;
  budgetType?: string;
}

export interface CreateContractPaymentParams {
  paymentNo: string;
  contractNo?: string;
  departmentName: string;
  amount: number;
  paymentDate: string;
  payee?: string;
  description?: string;
  requestNo?: string;
  period?: string;
  budgetType?: string;
}

export class BudgetAlreadyProcessedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetAlreadyProcessedError';
  }
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class InsufficientBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBudgetError';
  }
}

export class BudgetNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetNotConfiguredError';
  }
}

function findBudgetForDepartment(
  departmentId: string,
  period?: string,
  budgetType?: string
): Budget | undefined {
  const db = getDatabase();

  if (period && budgetType) {
    return getBudgetByDepartmentPeriodType(departmentId, period, budgetType);
  }

  if (period) {
    return db.prepare(`
      SELECT * FROM budgets 
      WHERE department_id = ? AND period = ? AND status = 'active'
      ORDER BY budget_type
      LIMIT 1
    `).get(departmentId, period) as Budget | undefined;
  }

  return db.prepare(`
    SELECT * FROM budgets 
    WHERE department_id = ? AND status = 'active'
    ORDER BY period DESC, budget_type
    LIMIT 1
  `).get(departmentId) as Budget | undefined;
}

function updateBudgetReserved(
  budgetId: string,
  amount: number,
  isAdd: boolean,
  relatedType: string,
  relatedId: string,
  operator?: string,
  description?: string
): void {
  const db = getDatabase();
  const budget = getBudgetById(budgetId);

  if (!budget) {
    throw new BudgetNotConfiguredError(`预算不存在: ${budgetId}`);
  }

  const newReserved = isAdd 
    ? budget.reserved_amount + amount 
    : budget.reserved_amount - amount;

  if (newReserved < 0) {
    throw new Error('预算预留金额不能为负');
  }

  db.prepare(`
    UPDATE budgets 
    SET reserved_amount = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newReserved, budgetId);

  const actionType = isAdd ? 'RESERVE' : 'RELEASE';
  recordBudgetHistory(
    budgetId,
    actionType,
    amount,
    relatedType,
    relatedId,
    operator,
    description
  );
}

function updateBudgetUsed(
  budgetId: string,
  amount: number,
  isAdd: boolean,
  relatedType: string,
  relatedId: string,
  operator?: string,
  description?: string
): void {
  const db = getDatabase();
  const budget = getBudgetById(budgetId);

  if (!budget) {
    throw new BudgetNotConfiguredError(`预算不存在: ${budgetId}`);
  }

  const newUsed = isAdd 
    ? budget.used_amount + amount 
    : budget.used_amount - amount;

  if (newUsed < 0) {
    throw new Error('预算已用金额不能为负');
  }

  db.prepare(`
    UPDATE budgets 
    SET used_amount = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newUsed, budgetId);

  const actionType = isAdd ? 'USE' : 'UNDO_USE';
  recordBudgetHistory(
    budgetId,
    actionType,
    amount,
    relatedType,
    relatedId,
    operator,
    description
  );
}

export function createPurchaseRequest(params: CreatePurchaseRequestParams): string {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM purchase_requests WHERE request_no = ?').get(params.requestNo) as PurchaseRequest | undefined;
  
  if (existing) {
    throw new BudgetAlreadyProcessedError(`采购申请已存在: ${params.requestNo}，请勿重复导入`);
  }

  if (params.requestedAmount <= 0) {
    throw new Error('申请金额必须大于0');
  }

  const departmentId = getOrCreateDepartment(params.departmentName);
  const budget = findBudgetForDepartment(departmentId, params.period, params.budgetType);

  if (!budget) {
    recordException(
      'BUDGET_NOT_CONFIGURED',
      `部门「${params.departmentName}」在「${params.period || '未指定'}」期间的「${params.budgetType || '未指定'}」类型预算未配置`,
      'error',
      'purchase_request',
      undefined,
      JSON.stringify({ 
        departmentName: params.departmentName,
        period: params.period,
        budgetType: params.budgetType,
        requestNo: params.requestNo
      })
    );

    const id = uuidv4();
    db.prepare(`
      INSERT INTO purchase_requests (
        id, request_no, department_id, item_name, requested_amount, 
        status, request_date, requester, description
      ) VALUES (?, ?, ?, ?, ?, 'needs_review', ?, ?, ?)
    `).run(
      id, params.requestNo, departmentId, params.itemName, params.requestedAmount,
      params.requestDate, params.requester || null, params.description || null
    );

    return id;
  }

  const availableForReservation = budget.amount - budget.used_amount - budget.reserved_amount;
  const isOverBudget = params.requestedAmount > availableForReservation;
  
  if (isOverBudget) {
    recordException(
      'BUDGET_EXCEEDED',
      `采购申请「${params.requestNo}」金额 ${params.requestedAmount.toLocaleString()} 超出可用预算，可用金额: ${availableForReservation.toLocaleString()}`,
      'critical',
      'purchase_request',
      undefined,
      JSON.stringify({ 
        requestNo: params.requestNo,
        requestedAmount: params.requestedAmount,
        budgetAmount: budget.amount,
        usedAmount: budget.used_amount,
        reservedAmount: budget.reserved_amount,
        availableAmount: availableForReservation
      })
    );
  }

  const id = uuidv4();
  const status = isOverBudget ? 'needs_review' : 'approved';
  
  db.prepare(`
    INSERT INTO purchase_requests (
      id, request_no, department_id, budget_id, item_name, requested_amount, 
      status, request_date, requester, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.requestNo, departmentId, budget.id, params.itemName, params.requestedAmount,
    status, params.requestDate, params.requester || null, params.description || null
  );

  if (!isOverBudget) {
    updateBudgetReserved(
      budget.id,
      params.requestedAmount,
      true,
      'purchase_request',
      id,
      params.requester,
      `采购申请占用预算: ${params.itemName}`
    );
  }

  return id;
}

export function createContractPayment(params: CreateContractPaymentParams): string {
  const db = getDatabase();

  const existing = db.prepare('SELECT id FROM contract_payments WHERE payment_no = ?').get(params.paymentNo) as ContractPayment | undefined;
  
  if (existing) {
    throw new BudgetAlreadyProcessedError(`付款记录已存在: ${params.paymentNo}，请勿重复导入`);
  }

  if (params.amount <= 0) {
    throw new Error('付款金额必须大于0');
  }

  const departmentId = getOrCreateDepartment(params.departmentName);
  
  let purchaseRequest: PurchaseRequest | undefined;
  if (params.requestNo) {
    purchaseRequest = db.prepare('SELECT * FROM purchase_requests WHERE request_no = ?').get(params.requestNo) as PurchaseRequest | undefined;
    
    if (!purchaseRequest) {
      recordException(
        'REQUEST_NOT_FOUND',
        `付款「${params.paymentNo}」关联的采购申请「${params.requestNo}」不存在`,
        'warning',
        'contract_payment',
        undefined,
        JSON.stringify({ 
          paymentNo: params.paymentNo,
          requestNo: params.requestNo
        })
      );
    }
  }

  let budget: Budget | undefined;
  
  if (purchaseRequest?.budget_id) {
    budget = getBudgetById(purchaseRequest.budget_id);
  } else {
    budget = findBudgetForDepartment(departmentId, params.period, params.budgetType);
  }

  if (!budget) {
    recordException(
      'BUDGET_NOT_CONFIGURED',
      `部门「${params.departmentName}」在「${params.period || '未指定'}」期间的「${params.budgetType || '未指定'}」类型预算未配置`,
      'error',
      'contract_payment',
      undefined,
      JSON.stringify({ 
        departmentName: params.departmentName,
        period: params.period,
        budgetType: params.budgetType,
        paymentNo: params.paymentNo
      })
    );

    const id = uuidv4();
    db.prepare(`
      INSERT INTO contract_payments (
        id, payment_no, contract_no, department_id, amount,
        status, payment_date, payee, description, purchase_request_id
      ) VALUES (?, ?, ?, ?, ?, 'needs_review', ?, ?, ?, ?)
    `).run(
      id, params.paymentNo, params.contractNo || null, departmentId, params.amount,
      params.paymentDate, params.payee || null, params.description || null,
      purchaseRequest?.id || null
    );

    return id;
  }

  const available = budget.amount - budget.used_amount;
  
  if (params.amount > available) {
    recordException(
      'BUDGET_OVERSPENT',
      `合同付款「${params.paymentNo}」导致预算超支，付款金额: ${params.amount.toLocaleString()}，预算余额: ${available.toLocaleString()}`,
      'critical',
      'contract_payment',
      undefined,
      JSON.stringify({ 
        paymentNo: params.paymentNo,
        paymentAmount: params.amount,
        budgetAmount: budget.amount,
        usedAmount: budget.used_amount,
        availableAmount: available
      })
    );
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO contract_payments (
      id, payment_no, contract_no, department_id, budget_id, purchase_request_id, amount,
      status, payment_date, payee, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
  `).run(
    id, params.paymentNo, params.contractNo || null, departmentId, budget.id,
    purchaseRequest?.id || null, params.amount,
    params.paymentDate, params.payee || null, params.description || null
  );

  if (purchaseRequest) {
    updateBudgetReserved(
      budget.id,
      purchaseRequest.requested_amount,
      false,
      'purchase_request',
      purchaseRequest.id,
      params.payee,
      `付款释放预算预留: ${params.paymentNo}`
    );

    db.prepare(`
      UPDATE purchase_requests 
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `).run(purchaseRequest.id);
  }

  updateBudgetUsed(
    budget.id,
    params.amount,
    true,
    'contract_payment',
    id,
    params.payee,
    `付款消耗预算: ${params.description || params.paymentNo}`
  );

  return id;
}

export function checkAllBudgets(): CheckResult[] {
  const db = getDatabase();
  const results: CheckResult[] = [];

  const budgetsWithDept = db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    WHERE b.status = 'active'
  `).all() as (Budget & { department_name: string })[];

  for (const budget of budgetsWithDept) {
    const totalCommitted = budget.used_amount + budget.reserved_amount;
    const remainingAmount = budget.amount - totalCommitted;
    const usageRate = budget.amount > 0 ? totalCommitted / budget.amount : 0;
    const issues: string[] = [];

    if (totalCommitted > budget.amount) {
      issues.push(`超支 ${(totalCommitted - budget.amount).toLocaleString()} 元（已用+预留已超出预算）`);
    }

    if (usageRate >= budget.threshold && totalCommitted <= budget.amount) {
      issues.push(`使用率达到 ${(usageRate * 100).toFixed(1)}%，超过阈值 ${(budget.threshold * 100)}%`);
    }

    const isOverThreshold = usageRate >= budget.threshold;
    const isOverBudget = totalCommitted > budget.amount;

    if (isOverBudget) {
      const existing = db.prepare(`
        SELECT 1 FROM exceptions 
        WHERE exception_type = 'BUDGET_ALARM' 
        AND related_id = ? 
        AND is_resolved = 0
      `).get(budget.id);

      if (!existing) {
        recordException(
          'BUDGET_ALARM',
          `部门「${budget.department_name}」「${budget.period}」期间「${budget.budget_type}」预算已超支，已用+预留共 ${totalCommitted.toLocaleString()} 元超出预算 ${budget.amount.toLocaleString()} 元`,
          'critical',
          'budget',
          budget.id,
          JSON.stringify({
            budgetAmount: budget.amount,
            usedAmount: budget.used_amount,
            reservedAmount: budget.reserved_amount,
            totalCommitted,
            overAmount: totalCommitted - budget.amount
          })
        );
      }
    }

    results.push({
      budgetId: budget.id,
      departmentName: budget.department_name,
      period: budget.period,
      budgetType: budget.budget_type,
      budgetAmount: budget.amount,
      usedAmount: budget.used_amount,
      reservedAmount: budget.reserved_amount,
      remainingAmount,
      usageRate,
      threshold: budget.threshold,
      isOverThreshold,
      isOverBudget,
      issues
    });
  }

  return results.sort((a, b) => b.usageRate - a.usageRate);
}

export function checkBudgetStatus(budgetId: string): CheckResult | undefined {
  const db = getDatabase();
  const budgetWithDept = db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    WHERE b.id = ?
  `).get(budgetId) as (Budget & { department_name: string }) | undefined;

  if (!budgetWithDept) {
    return undefined;
  }

  const totalCommitted = budgetWithDept.used_amount + budgetWithDept.reserved_amount;
  const remainingAmount = budgetWithDept.amount - totalCommitted;
  const usageRate = budgetWithDept.amount > 0 ? totalCommitted / budgetWithDept.amount : 0;
  const issues: string[] = [];

  if (totalCommitted > budgetWithDept.amount) {
    issues.push(`超支 ${(totalCommitted - budgetWithDept.amount).toLocaleString()} 元（已用+预留已超出预算）`);
  }

  if (usageRate >= budgetWithDept.threshold && totalCommitted <= budgetWithDept.amount) {
    issues.push(`使用率达到 ${(usageRate * 100).toFixed(1)}%，超过阈值 ${(budgetWithDept.threshold * 100)}%`);
  }

  return {
    budgetId: budgetWithDept.id,
    departmentName: budgetWithDept.department_name,
    period: budgetWithDept.period,
    budgetType: budgetWithDept.budget_type,
    budgetAmount: budgetWithDept.amount,
    usedAmount: budgetWithDept.used_amount,
    reservedAmount: budgetWithDept.reserved_amount,
    remainingAmount,
    usageRate,
    threshold: budgetWithDept.threshold,
    isOverThreshold: usageRate >= budgetWithDept.threshold,
    isOverBudget: totalCommitted > budgetWithDept.amount,
    issues
  };
}
