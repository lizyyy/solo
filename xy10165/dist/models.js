"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateDepartment = getOrCreateDepartment;
exports.createOrUpdateBudget = createOrUpdateBudget;
exports.getBudgetById = getBudgetById;
exports.getBudgetByDepartmentPeriodType = getBudgetByDepartmentPeriodType;
exports.recordBudgetHistory = recordBudgetHistory;
exports.recordException = recordException;
exports.getAllDepartments = getAllDepartments;
exports.getAllBudgets = getAllBudgets;
exports.getAllPurchaseRequests = getAllPurchaseRequests;
exports.getAllContractPayments = getAllContractPayments;
exports.getBudgetHistory = getBudgetHistory;
exports.getExceptions = getExceptions;
exports.getImportLogs = getImportLogs;
exports.resolveException = resolveException;
const database_1 = require("./database");
const uuid_1 = require("uuid");
function getOrCreateDepartment(name) {
    const db = (0, database_1.getDatabase)();
    const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
    if (existing) {
        return existing.id;
    }
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO departments (id, name)
    VALUES (?, ?)
  `).run(id, name);
    return id;
}
function createOrUpdateBudget(departmentName, period, budgetType, amount, threshold = 0.8, description) {
    const db = (0, database_1.getDatabase)();
    const departmentId = getOrCreateDepartment(departmentName);
    const existing = db.prepare(`
    SELECT id FROM budgets 
    WHERE department_id = ? AND period = ? AND budget_type = ?
  `).get(departmentId, period, budgetType);
    if (existing) {
        db.prepare(`
      UPDATE budgets 
      SET amount = ?, threshold = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(amount, threshold, description || null, existing.id);
        return existing.id;
    }
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO budgets (id, department_id, period, budget_type, amount, used_amount, reserved_amount, threshold, description)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(id, departmentId, period, budgetType, amount, threshold, description || null);
    return id;
}
function getBudgetById(id) {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
}
function getBudgetByDepartmentPeriodType(departmentId, period, budgetType) {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT * FROM budgets 
    WHERE department_id = ? AND period = ? AND budget_type = ?
  `).get(departmentId, period, budgetType);
}
function recordBudgetHistory(budgetId, actionType, amount, relatedType, relatedId, operator, description) {
    const db = (0, database_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO budget_history (id, budget_id, action_type, amount, related_type, related_id, operator, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, budgetId, actionType, amount, relatedType || null, relatedId || null, operator || null, description || null);
}
function recordException(exceptionType, message, severity = 'warning', relatedType, relatedId, details) {
    const db = (0, database_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO exceptions (id, exception_type, severity, related_type, related_id, message, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, exceptionType, severity, relatedType || null, relatedId || null, message, details || null);
    return id;
}
function getAllDepartments() {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM departments ORDER BY name').all();
}
function getAllBudgets() {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    ORDER BY d.name, b.period, b.budget_type
  `).all();
}
function getAllPurchaseRequests() {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT pr.*, d.name as department_name, b.period as budget_period, b.budget_type
    FROM purchase_requests pr
    JOIN departments d ON pr.department_id = d.id
    LEFT JOIN budgets b ON pr.budget_id = b.id
    ORDER BY pr.request_date DESC
  `).all();
}
function getAllContractPayments() {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT cp.*, d.name as department_name, b.period as budget_period, b.budget_type, pr.request_no
    FROM contract_payments cp
    JOIN departments d ON cp.department_id = d.id
    LEFT JOIN budgets b ON cp.budget_id = b.id
    LEFT JOIN purchase_requests pr ON cp.purchase_request_id = pr.id
    ORDER BY cp.payment_date DESC
  `).all();
}
function getBudgetHistory(budgetId) {
    const db = (0, database_1.getDatabase)();
    if (budgetId) {
        return db.prepare(`
      SELECT bh.*, d.name as department_name, b.period, b.budget_type
      FROM budget_history bh
      JOIN budgets b ON bh.budget_id = b.id
      JOIN departments d ON b.department_id = d.id
      WHERE bh.budget_id = ?
      ORDER BY bh.created_at DESC
    `).all(budgetId);
    }
    return db.prepare(`
    SELECT bh.*, d.name as department_name, b.period, b.budget_type
    FROM budget_history bh
    JOIN budgets b ON bh.budget_id = b.id
    JOIN departments d ON b.department_id = d.id
    ORDER BY bh.created_at DESC
  `).all();
}
function getExceptions(isResolved) {
    const db = (0, database_1.getDatabase)();
    if (isResolved !== undefined) {
        return db.prepare(`
      SELECT * FROM exceptions 
      WHERE is_resolved = ?
      ORDER BY created_at DESC
    `).all(isResolved ? 1 : 0);
    }
    return db.prepare(`
    SELECT * FROM exceptions 
    ORDER BY is_resolved ASC, created_at DESC
  `).all();
}
function getImportLogs() {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT * FROM import_logs 
    ORDER BY created_at DESC
    LIMIT 100
  `).all();
}
function resolveException(id) {
    const db = (0, database_1.getDatabase)();
    db.prepare(`
    UPDATE exceptions 
    SET is_resolved = 1, resolved_at = datetime('now')
    WHERE id = ?
  `).run(id);
}
//# sourceMappingURL=models.js.map