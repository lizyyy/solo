const { getKnex } = require('../db/knex');
const { AppError, errorCodes } = require('../utils/response');

class ReportService {
  constructor() {
    this.db = getKnex();
  }

  async getDepartmentBudgetReport(departmentId, fiscalYear = null) {
    const department = await this.db('departments')
      .where('id', departmentId)
      .first();

    if (!department) {
      throw new AppError(errorCodes.DEPARTMENT_NOT_FOUND, { departmentId });
    }

    let query = this.db('budgets')
      .where('department_id', departmentId)
      .orderBy('created_at', 'desc');

    if (fiscalYear) {
      query = query.where('fiscal_year', fiscalYear);
    }

    const budgets = await query;

    const budgetTypeStats = {};
    
    for (const budget of budgets) {
      const total = parseFloat(budget.total_amount);
      const used = parseFloat(budget.used_amount);
      const locked = parseFloat(budget.locked_amount);
      const available = parseFloat(budget.available_amount);
      
      if (!budgetTypeStats[budget.budget_type]) {
        budgetTypeStats[budget.budget_type] = {
          budgetType: budget.budget_type,
          totalAmount: 0,
          usedAmount: 0,
          lockedAmount: 0,
          availableAmount: 0,
          usageRate: 0,
          budgets: []
        };
      }

      budgetTypeStats[budget.budget_type].totalAmount += total;
      budgetTypeStats[budget.budget_type].usedAmount += used;
      budgetTypeStats[budget.budget_type].lockedAmount += locked;
      budgetTypeStats[budget.budget_type].availableAmount += available;
      budgetTypeStats[budget.budget_type].budgets.push({
        id: budget.id,
        fiscalYear: budget.fiscal_year,
        totalAmount: total,
        usedAmount: used,
        lockedAmount: locked,
        availableAmount: available,
        isActive: budget.is_active,
        startDate: budget.start_date,
        endDate: budget.end_date
      });
    }

    for (const type in budgetTypeStats) {
      const stats = budgetTypeStats[type];
      stats.usageRate = stats.totalAmount > 0 
        ? ((stats.usedAmount + stats.lockedAmount) / stats.totalAmount * 100).toFixed(2)
        : 0;
    }

    const activeLocks = await this.db('budget_locks')
      .where('department_id', departmentId)
      .where('status', 'ACTIVE')
      .orderBy('created_at', 'desc');

    const activeApprovals = await this.db('approval_records')
      .join('budget_locks', 'approval_records.budget_lock_id', '=', 'budget_locks.id')
      .where('budget_locks.department_id', departmentId)
      .where('approval_records.status', 'PENDING')
      .select(
        'approval_records.id as approval_id',
        'approval_records.application_id',
        'approval_records.status as approval_status',
        'approval_records.current_approver',
        'budget_locks.id as lock_id',
        'budget_locks.amount as lock_amount',
        'budget_locks.expires_at',
        'budget_locks.application_type'
      )
      .orderBy('approval_records.created_at', 'desc');

    const transactionLogCount = await this.db('transaction_logs')
      .where('department_id', departmentId)
      .count('id as count')
      .first();

    return {
      department: {
        id: department.id,
        name: department.name,
        code: department.code
      },
      summary: {
        fiscalYear,
        totalBudgets: budgets.length,
        budgetTypes: Object.keys(budgetTypeStats).length,
        activeLocks: activeLocks.length,
        pendingApprovals: activeApprovals.length,
        totalTransactions: parseInt(transactionLogCount.count || 0)
      },
      budgetByType: Object.values(budgetTypeStats),
      activeLocks: activeLocks.map(lock => ({
        id: lock.id,
        applicationId: lock.application_id,
        applicationType: lock.application_type,
        amount: parseFloat(lock.amount),
        createdAt: lock.created_at,
        expiresAt: lock.expires_at,
        createdBy: lock.created_by
      })),
      pendingApprovals: activeApprovals.map(app => ({
        approvalId: app.approval_id,
        applicationId: app.application_id,
        lockId: app.lock_id,
        lockAmount: parseFloat(app.lock_amount),
        currentApprover: app.current_approver,
        applicationType: app.application_type,
        lockExpiresAt: app.expires_at
      }))
    };
  }

  async getBudgetUsageTrend(departmentId, budgetType, fiscalYear) {
    const logs = await this.db('transaction_logs')
      .where('department_id', departmentId)
      .where('operation_type', 'in', ['BUDGET_LOCK', 'BUDGET_LOCK_COMMIT', 'BUDGET_LOCK_RELEASE'])
      .orderBy('created_at', 'asc');

    const budget = await this.db('budgets')
      .where('department_id', departmentId)
      .where('budget_type', budgetType)
      .where('fiscal_year', fiscalYear)
      .first();

    if (!budget) {
      throw new AppError(errorCodes.BUDGET_NOT_FOUND, { departmentId, budgetType, fiscalYear });
    }

    let runningUsed = parseFloat(budget.used_amount);
    let runningLocked = parseFloat(budget.locked_amount);
    const trend = [];

    for (const log of logs) {
      const amount = parseFloat(log.amount) || 0;
      
      if (log.operation_type === 'BUDGET_LOCK') {
        runningLocked += amount;
      } else if (log.operation_type === 'BUDGET_LOCK_COMMIT') {
        runningLocked -= amount;
        runningUsed += amount;
      } else if (log.operation_type === 'BUDGET_LOCK_RELEASE') {
        runningLocked -= amount;
      }

      trend.push({
        timestamp: log.created_at,
        operationType: log.operation_type,
        amount,
        usedAmount: runningUsed,
        lockedAmount: runningLocked,
        operator: log.operator
      });
    }

    return {
      budget: {
        id: budget.id,
        totalAmount: parseFloat(budget.total_amount),
        currentUsed: parseFloat(budget.used_amount),
        currentLocked: parseFloat(budget.locked_amount),
        currentAvailable: parseFloat(budget.available_amount)
      },
      trend,
      totalOperations: trend.length
    };
  }

  async getAllDepartmentsReport(fiscalYear = null) {
    const departments = await this.db('departments')
      .orderBy('code', 'asc');

    const reports = [];
    
    for (const dept of departments) {
      try {
        const report = await this.getDepartmentBudgetReport(dept.id, fiscalYear);
        reports.push(report);
      } catch (e) {
        reports.push({
          department: { id: dept.id, name: dept.name, code: dept.code },
          error: e.message
        });
      }
    }

    const summary = {
      totalDepartments: reports.length,
      overallTotal: 0,
      overallUsed: 0,
      overallLocked: 0,
      overallAvailable: 0,
      totalActiveLocks: 0,
      totalPendingApprovals: 0
    };

    for (const report of reports) {
      if (report.summary) {
        summary.totalActiveLocks += report.summary.activeLocks;
        summary.totalPendingApprovals += report.summary.pendingApprovals;
        
        for (const typeStats of report.budgetByType) {
          summary.overallTotal += typeStats.totalAmount;
          summary.overallUsed += typeStats.usedAmount;
          summary.overallLocked += typeStats.lockedAmount;
          summary.overallAvailable += typeStats.availableAmount;
        }
      }
    }

    summary.overallUsageRate = summary.overallTotal > 0
      ? ((summary.overallUsed + summary.overallLocked) / summary.overallTotal * 100).toFixed(2)
      : 0;

    return {
      fiscalYear,
      summary,
      departmentReports: reports
    };
  }
}

module.exports = ReportService;
