import { db } from '../db';

export interface DepartmentSummary {
  department: string;
  employeeCount: number;
  approvedAmount: number;
  suspendedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  abnormalCount: number;
  abnormalBreakdown: { type: string; count: number }[];
  employees: {
    employeeId: string;
    name: string;
    approvedAmount: number;
    suspendedAmount: number;
    pendingAmount: number;
    abnormalReasons: string[];
    adjustments: {
      date: string;
      previousAmount: number;
      newAmount: number;
      difference: number;
      operator: string;
      action: string;
      reason: string;
      createdAt: string;
    }[];
  }[];
}

export function getSummaryByDepartment(batchId: string): DepartmentSummary[] {
  const deptMap = new Map<string, DepartmentSummary>();

  const employees = db.prepare(`
    SELECT e.employee_id, e.name, e.department
    FROM employees e
    WHERE EXISTS (
      SELECT 1 FROM subsidy_calculations sc
      WHERE sc.employee_id = e.employee_id AND sc.batch_id = ?
    )
  `).all(batchId) as any[];

  for (const emp of employees) {
    const dept = emp.department;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        department: dept,
        employeeCount: 0,
        approvedAmount: 0,
        suspendedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        abnormalCount: 0,
        abnormalBreakdown: [],
        employees: [],
      });
    }

    const deptSummary = deptMap.get(dept)!;
    deptSummary.employeeCount++;

    const calcs = db.prepare(`
      SELECT sc.*, ar.abnormal_id, ar.type as abnormal_type, ar.description as abnormal_desc
      FROM subsidy_calculations sc
      LEFT JOIN abnormal_records ar ON ar.batch_id = sc.batch_id AND ar.employee_id = sc.employee_id
      WHERE sc.employee_id = ? AND sc.batch_id = ?
    `).all(emp.employee_id, batchId) as any[];

    const calcMap = new Map<string, any>();
    const abnormalTypes = new Map<string, number>();
    const abnormalReasons: string[] = [];

    for (const c of calcs) {
      if (!calcMap.has(c.calculation_id)) {
        calcMap.set(c.calculation_id, {
          calculationId: c.calculation_id,
          date: c.date,
          originalAmount: c.original_amount,
          adjustedAmount: c.adjusted_amount,
          status: c.status,
          approvalStatus: c.approval_status,
        });
      }

      if (c.abnormal_id) {
        abnormalTypes.set(c.abnormal_type, (abnormalTypes.get(c.abnormal_type) || 0) + 1);
        if (!abnormalReasons.includes(c.abnormal_desc)) {
          abnormalReasons.push(c.abnormal_desc);
        }
      }
    }

    let empApproved = 0;
    let empSuspended = 0;
    let empPending = 0;

    for (const c of calcMap.values()) {
      if (c.approvalStatus === 'approved') {
        empApproved += c.adjustedAmount;
      } else if (c.approvalStatus === 'rejected' || c.status === 'suspended') {
        empSuspended += c.originalAmount;
      } else if (c.approvalStatus === 'pending') {
        empPending += c.originalAmount;
      }
    }

    const approvals = db.prepare(`
      SELECT ar.*, sc.date
      FROM approval_records ar
      JOIN subsidy_calculations sc ON sc.calculation_id = ar.calculation_id
      WHERE ar.employee_id = ? AND sc.batch_id = ?
      ORDER BY ar.created_at DESC
    `).all(emp.employee_id, batchId) as any[];

    const adjustments = approvals.map(a => ({
      date: a.date,
      previousAmount: a.action === 'adjust' ? (a.new_amount === null ? 0 : a.new_amount) - 0 : a.new_amount || 0,
      newAmount: a.new_amount || 0,
      difference: 0,
      operator: a.operator,
      action: a.action,
      reason: a.reason,
      createdAt: a.created_at,
    }));

    deptSummary.approvedAmount += empApproved;
    deptSummary.suspendedAmount += empSuspended;
    deptSummary.pendingAmount += empPending;
    if (empPending > 0) {
      deptSummary.pendingCount++;
    }

    const empAbnormalCount = abnormalTypes.size;
    deptSummary.abnormalCount += empAbnormalCount;

    deptSummary.employees.push({
      employeeId: emp.employee_id,
      name: emp.name,
      approvedAmount: empApproved,
      suspendedAmount: empSuspended,
      pendingAmount: empPending,
      abnormalReasons,
      adjustments,
    });
  }

  for (const dept of deptMap.values()) {
    const breakdown = db.prepare(`
      SELECT ar.type, COUNT(*) as count
      FROM abnormal_records ar
      JOIN employees e ON e.employee_id = ar.employee_id
      WHERE ar.batch_id = ? AND e.department = ?
      GROUP BY ar.type
    `).all(batchId, dept.department) as any[];

    dept.abnormalBreakdown = breakdown.map((b: any) => ({
      type: b.type,
      count: b.count,
    }));
  }

  return Array.from(deptMap.values());
}

export interface DifferenceRecord {
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  originalAmount: number;
  adjustedAmount: number;
  difference: number;
  operator: string;
  action: string;
  reason: string;
  adjustedAt: string;
}

export function getApprovalDifferences(batchId: string): {
  totalDifference: number;
  records: DifferenceRecord[];
} {
  const records: DifferenceRecord[] = [];

  const approvals = db.prepare(`
    SELECT
      ar.*,
      e.name as employee_name,
      e.department,
      sc.date,
      sc.original_amount,
      sc.adjusted_amount
    FROM approval_records ar
    JOIN employees e ON e.employee_id = ar.employee_id
    JOIN subsidy_calculations sc ON sc.calculation_id = ar.calculation_id
    WHERE sc.batch_id = ?
    ORDER BY ar.created_at DESC
  `).all(batchId) as any[];

  let totalDifference = 0;

  for (const a of approvals) {
    let diff = 0;
    if (a.action === 'approve') {
      diff = a.adjusted_amount - a.original_amount;
    } else if (a.action === 'reject') {
      diff = 0 - a.original_amount;
    } else if (a.action === 'adjust') {
      diff = (a.new_amount || 0) - a.original_amount;
    }

    totalDifference += diff;

    records.push({
      employeeId: a.employee_id,
      employeeName: a.employee_name,
      department: a.department,
      date: a.date,
      originalAmount: a.original_amount,
      adjustedAmount: a.action === 'adjust' ? (a.new_amount || 0) : a.adjusted_amount,
      difference: diff,
      operator: a.operator,
      action: a.action,
      reason: a.reason,
      adjustedAt: a.created_at,
    });
  }

  return {
    totalDifference,
    records,
  };
}

export interface PayoutReport {
  batchId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  departments: {
    department: string;
  employeeCount: number;
  totalAmount: number;
  employees: {
    employeeId: string;
    name: string;
    totalAmount: number;
    days: {
      date: string;
      amount: number;
      status: string;
    }[];
  }[];
}[];
  summary: {
    totalEmployees: number;
  totalAmount: number;
};
}

export function getPayoutReport(batchId: string): PayoutReport {
  const batch = db.prepare('SELECT * FROM calculation_batches WHERE batch_id = ?').get(batchId) as any;

  if (!batch) {
    throw new Error('批次不存在');
  }

  const deptMap = new Map<string, any>();

  const calcs = db.prepare(`
    SELECT sc.*, e.name, e.department
    FROM subsidy_calculations sc
    JOIN employees e ON e.employee_id = sc.employee_id
    WHERE sc.batch_id = ? AND sc.approval_status = 'approved'
    ORDER BY e.department, e.employee_id, sc.date
  `).all(batchId) as any[];

  let totalEmployees = 0;
  let totalAmount = 0;

  const empSet = new Set<string>();

  for (const c of calcs) {
    const dept = c.department;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        department: dept,
        employeeCount: 0,
        totalAmount: 0,
        employees: [],
      });
    }

    const deptData = deptMap.get(dept)!;

    let empData = deptData.employees.find((e: any) => e.employeeId === c.employee_id);
    if (!empData) {
      empData = {
        employeeId: c.employee_id,
        name: c.name,
        totalAmount: 0,
        days: [],
      };
      deptData.employees.push(empData);
      deptData.employeeCount++;
      empSet.add(c.employee_id);
    }

    empData.days.push({
      date: c.date,
      amount: c.adjusted_amount,
      status: c.status,
    });

    empData.totalAmount += c.adjusted_amount;
    deptData.totalAmount += c.adjusted_amount;
    totalAmount += c.adjusted_amount;
  }

  totalEmployees = empSet.size;

  return {
    batchId,
    periodStart: batch.period_start,
    periodEnd: batch.period_end,
    generatedAt: new Date().toISOString(),
    departments: Array.from(deptMap.values()),
    summary: {
      totalEmployees,
      totalAmount,
    },
  };
}

export function getAbnormalDetails(batchId: string, type?: string) {
  let sql = `
    SELECT ar.*, e.name, e.department
    FROM abnormal_records ar
    JOIN employees e ON e.employee_id = ar.employee_id
    WHERE ar.batch_id = ?
  `;
  const params: any[] = [batchId];

  if (type) {
    sql += ' AND ar.type = ?';
    params.push(type);
  }

  sql += ' ORDER BY ar.detected_at DESC';

  const records = db.prepare(sql).all(...params) as any[];

  return records.map(r => ({
    abnormalId: r.abnormal_id,
    employeeId: r.employee_id,
    employeeName: r.name,
    department: r.department,
    transactionId: r.transaction_id,
    type: r.type,
    description: r.description,
    detectedAt: r.detected_at,
  }));
}

export function getBatchList() {
  const batches = db.prepare(`
    SELECT * FROM calculation_batches ORDER BY created_at DESC
  `).all() as any[];

  return batches.map(b => ({
    batchId: b.batch_id,
    periodStart: b.period_start,
    periodEnd: b.period_end,
    ruleId: b.rule_id,
    status: b.status,
    createdAt: b.created_at,
    completedAt: b.completed_at,
  }));
}
