import { getDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export interface Department {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  department_id: string;
  period: string;
  budget_type: string;
  amount: number;
  used_amount: number;
  reserved_amount: number;
  threshold: number;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequest {
  id: string;
  request_no: string;
  department_id: string;
  budget_id?: string;
  item_name: string;
  requested_amount: number;
  approved_amount?: number;
  status: string;
  request_date: string;
  requester?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractPayment {
  id: string;
  payment_no: string;
  contract_no?: string;
  department_id: string;
  budget_id?: string;
  purchase_request_id?: string;
  amount: number;
  payment_date: string;
  status: string;
  payee?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetHistory {
  id: string;
  budget_id: string;
  action_type: string;
  amount: number;
  related_type?: string;
  related_id?: string;
  operator?: string;
  description?: string;
  created_at: string;
}

export interface Exception {
  id: string;
  exception_type: string;
  severity: string;
  related_type?: string;
  related_id?: string;
  message: string;
  details?: string;
  is_resolved: number;
  resolved_at?: string;
  created_at: string;
}

export interface ImportLog {
  id: string;
  file_name: string;
  file_type: string;
  total_records: number;
  success_count: number;
  error_count: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export function getOrCreateDepartment(name: string): string {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name) as Department | undefined;
  
  if (existing) {
    return existing.id;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO departments (id, name)
    VALUES (?, ?)
  `).run(id, name);

  return id;
}

export function createOrUpdateBudget(
  departmentName: string,
  period: string,
  budgetType: string,
  amount: number,
  threshold: number = 0.8,
  description?: string
): string {
  const db = getDatabase();
  const departmentId = getOrCreateDepartment(departmentName);

  const existing = db.prepare(`
    SELECT id FROM budgets 
    WHERE department_id = ? AND period = ? AND budget_type = ?
  `).get(departmentId, period, budgetType) as Budget | undefined;

  if (existing) {
    db.prepare(`
      UPDATE budgets 
      SET amount = ?, threshold = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(amount, threshold, description || null, existing.id);
    return existing.id;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO budgets (id, department_id, period, budget_type, amount, used_amount, reserved_amount, threshold, description)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(id, departmentId, period, budgetType, amount, threshold, description || null);

  return id;
}

export function getBudgetById(id: string): Budget | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget | undefined;
}

export function getBudgetByDepartmentPeriodType(
  departmentId: string,
  period: string,
  budgetType: string
): Budget | undefined {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM budgets 
    WHERE department_id = ? AND period = ? AND budget_type = ?
  `).get(departmentId, period, budgetType) as Budget | undefined;
}

export function recordBudgetHistory(
  budgetId: string,
  actionType: string,
  amount: number,
  relatedType?: string,
  relatedId?: string,
  operator?: string,
  description?: string
): void {
  const db = getDatabase();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO budget_history (id, budget_id, action_type, amount, related_type, related_id, operator, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, budgetId, actionType, amount, relatedType || null, relatedId || null, operator || null, description || null);
}

export function recordException(
  exceptionType: string,
  message: string,
  severity: string = 'warning',
  relatedType?: string,
  relatedId?: string,
  details?: string
): string {
  const db = getDatabase();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO exceptions (id, exception_type, severity, related_type, related_id, message, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, exceptionType, severity, relatedType || null, relatedId || null, message, details || null);

  return id;
}

export function getAllDepartments(): Department[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM departments ORDER BY name').all() as Department[];
}

export function getAllBudgets(): Budget[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT b.*, d.name as department_name
    FROM budgets b
    JOIN departments d ON b.department_id = d.id
    ORDER BY d.name, b.period, b.budget_type
  `).all() as (Budget & { department_name: string })[];
}

export function getAllPurchaseRequests(): (PurchaseRequest & { department_name: string; budget_period?: string; budget_type?: string })[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT pr.*, d.name as department_name, b.period as budget_period, b.budget_type
    FROM purchase_requests pr
    JOIN departments d ON pr.department_id = d.id
    LEFT JOIN budgets b ON pr.budget_id = b.id
    ORDER BY pr.request_date DESC
  `).all() as (PurchaseRequest & { department_name: string; budget_period?: string; budget_type?: string })[];
}

export function getAllContractPayments(): (ContractPayment & { department_name: string; budget_period?: string; budget_type?: string; request_no?: string })[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT cp.*, d.name as department_name, b.period as budget_period, b.budget_type, pr.request_no
    FROM contract_payments cp
    JOIN departments d ON cp.department_id = d.id
    LEFT JOIN budgets b ON cp.budget_id = b.id
    LEFT JOIN purchase_requests pr ON cp.purchase_request_id = pr.id
    ORDER BY cp.payment_date DESC
  `).all() as (ContractPayment & { department_name: string; budget_period?: string; budget_type?: string; request_no?: string })[];
}

export function getBudgetHistory(budgetId?: string): (BudgetHistory & { department_name?: string; period?: string; budget_type?: string })[] {
  const db = getDatabase();
  
  if (budgetId) {
    return db.prepare(`
      SELECT bh.*, d.name as department_name, b.period, b.budget_type
      FROM budget_history bh
      JOIN budgets b ON bh.budget_id = b.id
      JOIN departments d ON b.department_id = d.id
      WHERE bh.budget_id = ?
      ORDER BY bh.created_at DESC
    `).all(budgetId) as (BudgetHistory & { department_name?: string; period?: string; budget_type?: string })[];
  }

  return db.prepare(`
    SELECT bh.*, d.name as department_name, b.period, b.budget_type
    FROM budget_history bh
    JOIN budgets b ON bh.budget_id = b.id
    JOIN departments d ON b.department_id = d.id
    ORDER BY bh.created_at DESC
  `).all() as (BudgetHistory & { department_name?: string; period?: string; budget_type?: string })[];
}

export function getExceptions(isResolved?: boolean): Exception[] {
  const db = getDatabase();
  
  if (isResolved !== undefined) {
    return db.prepare(`
      SELECT * FROM exceptions 
      WHERE is_resolved = ?
      ORDER BY created_at DESC
    `).all(isResolved ? 1 : 0) as Exception[];
  }

  return db.prepare(`
    SELECT * FROM exceptions 
    ORDER BY is_resolved ASC, created_at DESC
  `).all() as Exception[];
}

export function getImportLogs(): ImportLog[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM import_logs 
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as ImportLog[];
}

export function resolveException(id: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE exceptions 
    SET is_resolved = 1, resolved_at = datetime('now')
    WHERE id = ?
  `).run(id);
}
