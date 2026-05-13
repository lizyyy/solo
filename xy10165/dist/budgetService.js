"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetNotConfiguredError = exports.InsufficientBudgetError = exports.BudgetExceededError = exports.BudgetAlreadyProcessedError = void 0;
exports.createPurchaseRequest = createPurchaseRequest;
exports.createContractPayment = createContractPayment;
exports.checkAllBudgets = checkAllBudgets;
exports.checkBudgetStatus = checkBudgetStatus;
const database_1 = require("./database");
const uuid_1 = require("uuid");
const models_1 = require("./models");
class BudgetAlreadyProcessedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BudgetAlreadyProcessedError';
    }
}
exports.BudgetAlreadyProcessedError = BudgetAlreadyProcessedError;
class BudgetExceededError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BudgetExceededError';
    }
}
exports.BudgetExceededError = BudgetExceededError;
class InsufficientBudgetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InsufficientBudgetError';
    }
}
exports.InsufficientBudgetError = InsufficientBudgetError;
class BudgetNotConfiguredError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BudgetNotConfiguredError';
    }
}
exports.BudgetNotConfiguredError = BudgetNotConfiguredError;
function findBudgetForDepartment(departmentId, period, budgetType) {
    const db = (0, database_1.getDatabase)();
    if (period && budgetType) {
        return (0, models_1.getBudgetByDepartmentPeriodType)(departmentId, period, budgetType);
    }
    if (period) {
        return db.prepare(`
      SELECT * FROM budgets 
      WHERE department_id = ? AND period = ? AND status = 'active'
      ORDER BY budget_type
      LIMIT 1
    `).get(departmentId, period);
    }
    return db.prepare(`
    SELECT * FROM budgets 
    WHERE department_id = ? AND status = 'active'
    ORDER BY period DESC, budget_type
    LIMIT 1
  `).get(departmentId);
}
function updateBudgetReserved(budgetId, amount, isAdd, relatedType, relatedId, operator, description) {
    const db = (0, database_1.getDatabase)();
    const budget = (0, models_1.getBudgetById)(budgetId);
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
    (0, models_1.recordBudgetHistory)(budgetId, actionType, amount, relatedType, relatedId, operator, description);
}
function updateBudgetUsed(budgetId, amount, isAdd, relatedType, relatedId, operator, description) {
    const db = (0, database_1.getDatabase)();
    const budget = (0, models_1.getBudgetById)(budgetId);
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
    (0, models_1.recordBudgetHistory)(budgetId, actionType, amount, relatedType, relatedId, operator, description);
}
function createPurchaseRequest(params) {
    const db = (0, database_1.getDatabase)();
    const existing = db.prepare('SELECT id FROM purchase_requests WHERE request_no = ?').get(params.requestNo);
    if (existing) {
        throw new BudgetAlreadyProcessedError(`采购申请已存在: ${params.requestNo}，请勿重复导入`);
    }
    if (params.requestedAmount <= 0) {
        throw new Error('申请金额必须大于0');
    }
    const departmentId = (0, models_1.getOrCreateDepartment)(params.departmentName);
    const budget = findBudgetForDepartment(departmentId, params.period, params.budgetType);
    if (!budget) {
        (0, models_1.recordException)('BUDGET_NOT_CONFIGURED', `部门「${params.departmentName}」在「${params.period || '未指定'}」期间的「${params.budgetType || '未指定'}」类型预算未配置`, 'error', 'purchase_request', undefined, JSON.stringify({
            departmentName: params.departmentName,
            period: params.period,
            budgetType: params.budgetType,
            requestNo: params.requestNo
        }));
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO purchase_requests (
        id, request_no, department_id, item_name, requested_amount, 
        status, request_date, requester, description
      ) VALUES (?, ?, ?, ?, ?, 'needs_review', ?, ?, ?)
    `).run(id, params.requestNo, departmentId, params.itemName, params.requestedAmount, params.requestDate, params.requester || null, params.description || null);
        return id;
    }
    const availableForReservation = budget.amount - budget.used_amount - budget.reserved_amount;
    if (params.requestedAmount > availableForReservation) {
        (0, models_1.recordException)('BUDGET_EXCEEDED', `采购申请「${params.requestNo}」金额 ${params.requestedAmount.toLocaleString()} 超出可用预算，可用金额: ${availableForReservation.toLocaleString()}`, 'critical', 'purchase_request', undefined, JSON.stringify({
            requestNo: params.requestNo,
            requestedAmount: params.requestedAmount,
            budgetAmount: budget.amount,
            usedAmount: budget.used_amount,
            reservedAmount: budget.reserved_amount,
            availableAmount: availableForReservation
        }));
    }
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO purchase_requests (
      id, request_no, department_id, budget_id, item_name, requested_amount, 
      status, request_date, requester, description
    ) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
  `).run(id, params.requestNo, departmentId, budget.id, params.itemName, params.requestedAmount, params.requestDate, params.requester || null, params.description || null);
    updateBudgetReserved(budget.id, params.requestedAmount, true, 'purchase_request', id, params.requester, `采购申请占用预算: ${params.itemName}`);
    return id;
}
function createContractPayment(params) {
    const db = (0, database_1.getDatabase)();
    const existing = db.prepare('SELECT id FROM contract_payments WHERE payment_no = ?').get(params.paymentNo);
    if (existing) {
        throw new BudgetAlreadyProcessedError(`付款记录已存在: ${params.paymentNo}，请勿重复导入`);
    }
    if (params.amount <= 0) {
        throw new Error('付款金额必须大于0');
    }
    const departmentId = (0, models_1.getOrCreateDepartment)(params.departmentName);
    let purchaseRequest;
    if (params.requestNo) {
        purchaseRequest = db.prepare('SELECT * FROM purchase_requests WHERE request_no = ?').get(params.requestNo);
        if (!purchaseRequest) {
            (0, models_1.recordException)('REQUEST_NOT_FOUND', `付款「${params.paymentNo}」关联的采购申请「${params.requestNo}」不存在`, 'warning', 'contract_payment', undefined, JSON.stringify({
                paymentNo: params.paymentNo,
                requestNo: params.requestNo
            }));
        }
    }
    let budget;
    if (purchaseRequest?.budget_id) {
        budget = (0, models_1.getBudgetById)(purchaseRequest.budget_id);
    }
    else {
        budget = findBudgetForDepartment(departmentId, params.period, params.budgetType);
    }
    if (!budget) {
        (0, models_1.recordException)('BUDGET_NOT_CONFIGURED', `部门「${params.departmentName}」在「${params.period || '未指定'}」期间的「${params.budgetType || '未指定'}」类型预算未配置`, 'error', 'contract_payment', undefined, JSON.stringify({
            departmentName: params.departmentName,
            period: params.period,
            budgetType: params.budgetType,
            paymentNo: params.paymentNo
        }));
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO contract_payments (
        id, payment_no, contract_no, department_id, amount,
        status, payment_date, payee, description, purchase_request_id
      ) VALUES (?, ?, ?, ?, ?, 'needs_review', ?, ?, ?, ?)
    `).run(id, params.paymentNo, params.contractNo || null, departmentId, params.amount, params.paymentDate, params.payee || null, params.description || null, purchaseRequest?.id || null);
        return id;
    }
    const available = budget.amount - budget.used_amount;
    if (params.amount > available) {
        (0, models_1.recordException)('BUDGET_OVERSPENT', `合同付款「${params.paymentNo}」导致预算超支，付款金额: ${params.amount.toLocaleString()}，预算余额: ${available.toLocaleString()}`, 'critical', 'contract_payment', undefined, JSON.stringify({
            paymentNo: params.paymentNo,
            paymentAmount: params.amount,
            budgetAmount: budget.amount,
            usedAmount: budget.used_amount,
            availableAmount: available
        }));
    }
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO contract_payments (
      id, payment_no, contract_no, department_id, budget_id, purchase_request_id, amount,
      status, payment_date, payee, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
  `).run(id, params.paymentNo, params.contractNo || null, departmentId, budget.id, purchaseRequest?.id || null, params.amount, params.paymentDate, params.payee || null, params.description || null);
    if (purchaseRequest) {
        updateBudgetReserved(budget.id, purchaseRequest.requested_amount, false, 'purchase_request', purchaseRequest.id, params.payee, `付款释放预算预留: ${params.paymentNo}`);
        db.prepare(`
      UPDATE purchase_requests 
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `).run(purchaseRequest.id);
    }
    updateBudgetUsed(budget.id, params.amount, true, 'contract_payment', id, params.payee, `付款消耗预算: ${params.description || params.paymentNo}`);
    return id;
}
function checkAllBudgets() {
    const db = (0, database_1.getDatabase)();
    const results = [];
    const budgetsWithDept = db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    WHERE b.status = 'active'
  `).all();
    for (const budget of budgetsWithDept) {
        const remainingAmount = budget.amount - budget.used_amount;
        const usageRate = budget.amount > 0 ? budget.used_amount / budget.amount : 0;
        const issues = [];
        if (budget.used_amount > budget.amount) {
            issues.push(`超支 ${(budget.used_amount - budget.amount).toLocaleString()} 元`);
        }
        if (usageRate >= budget.threshold && budget.used_amount <= budget.amount) {
            issues.push(`使用率达到 ${(usageRate * 100).toFixed(1)}%，超过阈值 ${(budget.threshold * 100)}%`);
        }
        const isOverThreshold = usageRate >= budget.threshold;
        const isOverBudget = budget.used_amount > budget.amount;
        if (isOverBudget) {
            const existing = db.prepare(`
        SELECT 1 FROM exceptions 
        WHERE exception_type = 'BUDGET_ALARM' 
        AND related_id = ? 
        AND is_resolved = 0
      `).get(budget.id);
            if (!existing) {
                (0, models_1.recordException)('BUDGET_ALARM', `部门「${budget.department_name}」「${budget.period}」期间「${budget.budget_type}」预算已超支`, 'critical', 'budget', budget.id, JSON.stringify({
                    budgetAmount: budget.amount,
                    usedAmount: budget.used_amount,
                    overAmount: budget.used_amount - budget.amount
                }));
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
function checkBudgetStatus(budgetId) {
    const db = (0, database_1.getDatabase)();
    const budgetWithDept = db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    WHERE b.id = ?
  `).get(budgetId);
    if (!budgetWithDept) {
        return undefined;
    }
    const remainingAmount = budgetWithDept.amount - budgetWithDept.used_amount;
    const usageRate = budgetWithDept.amount > 0 ? budgetWithDept.used_amount / budgetWithDept.amount : 0;
    const issues = [];
    if (budgetWithDept.used_amount > budgetWithDept.amount) {
        issues.push(`超支 ${(budgetWithDept.used_amount - budgetWithDept.amount).toLocaleString()} 元`);
    }
    if (usageRate >= budgetWithDept.threshold && budgetWithDept.used_amount <= budgetWithDept.amount) {
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
        isOverBudget: budgetWithDept.used_amount > budgetWithDept.amount,
        issues
    };
}
//# sourceMappingURL=budgetService.js.map