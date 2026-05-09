const pool = require('../database/pool');
const logger = require('../utils/logger');

async function getDepartmentById(departmentId) {
  const result = await pool.query(
    `SELECT * FROM departments WHERE id = $1`,
    [departmentId]
  );

  if (result.rows.length === 0) {
    return {
      success: false,
      businessCode: 'DEPARTMENT_NOT_FOUND',
      message: '部门不存在',
      data: { departmentId }
    };
  }

  const dept = result.rows[0];

  return {
    success: true,
    data: {
      id: dept.id,
      name: dept.name,
      totalBudget: dept.total_budget,
      usedBudget: dept.used_budget,
      lockedBudget: dept.locked_budget,
      availableBudget: dept.available_budget,
      budgetUtilizationRate: dept.total_budget > 0 
        ? ((dept.used_budget + dept.locked_budget) / dept.total_budget * 100).toFixed(2) + '%'
        : '0%',
      version: dept.version
    }
  };
}

async function getAllDepartments() {
  const result = await pool.query(
    `SELECT * FROM departments ORDER BY name`
  );

  const departments = result.rows.map(dept => ({
    id: dept.id,
    name: dept.name,
    totalBudget: dept.total_budget,
    usedBudget: dept.used_budget,
    lockedBudget: dept.locked_budget,
    availableBudget: dept.available_budget,
    budgetUtilizationRate: dept.total_budget > 0
      ? ((dept.used_budget + dept.locked_budget) / dept.total_budget * 100).toFixed(2) + '%'
      : '0%'
  }));

  return {
    success: true,
    data: departments
  };
}

async function getDepartmentReport(departmentId) {
  const deptResult = await getDepartmentById(departmentId);
  
  if (!deptResult.success) {
    return deptResult;
  }

  const dept = deptResult.data;

  const travelRequestsResult = await pool.query(
    `SELECT status, COUNT(*) as count, SUM(estimated_amount) as total_amount
     FROM travel_requests 
     WHERE department_id = $1
     GROUP BY status`,
    [departmentId]
  );

  const statusBreakdown = {};
  for (const row of travelRequestsResult.rows) {
    statusBreakdown[row.status] = {
      count: parseInt(row.count),
      totalAmount: row.total_amount
    };
  }

  const activeLocksResult = await pool.query(
    `SELECT bl.*, tr.purpose, tr.destination, e.name as employee_name
     FROM budget_locks bl
     JOIN travel_requests tr ON bl.travel_request_id = tr.id
     JOIN employees e ON tr.employee_id = e.id
     WHERE bl.department_id = $1 AND bl.status = 'ACTIVE'
     ORDER BY bl.created_at DESC`,
    [departmentId]
  );

  const recentOperationsResult = await pool.query(
    `SELECT * FROM budget_operations 
     WHERE department_id = $1 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [departmentId]
  );

  const reimbursementsResult = await pool.query(
    `SELECT r.*, tr.purpose, tr.destination, e.name as employee_name
     FROM reimbursements r
     JOIN travel_requests tr ON r.travel_request_id = tr.id
     JOIN employees e ON tr.employee_id = e.id
     WHERE r.department_id = $1
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [departmentId]
  );

  const summary = {
    totalRequests: 0,
    approvedRequests: statusBreakdown['APPROVED']?.count || 0,
    pendingRequests: statusBreakdown['PENDING_APPROVAL']?.count || 0,
    completedRequests: statusBreakdown['COMPLETED']?.count || 0,
    cancelledRequests: statusBreakdown['CANCELLED']?.count || 0,
    activeLocksCount: activeLocksResult.rows.length,
    totalLockedAmount: activeLocksResult.rows.reduce((sum, lock) => sum + parseFloat(lock.locked_amount), 0)
  };

  logger.info('部门报表查询', {
    departmentId,
    departmentName: dept.name
  });

  return {
    success: true,
    businessCode: 'DEPARTMENT_REPORT_READY',
    message: `部门报表已生成：${dept.name}`,
    data: {
      department: dept,
      summary: {
        ...summary,
        summaryText: `预算总额¥${dept.totalBudget.toFixed(2)}，已使用¥${dept.usedBudget.toFixed(2)}，锁定中¥${dept.lockedBudget.toFixed(2)}，可用¥${dept.availableBudget.toFixed(2)}，预算使用率${dept.budgetUtilizationRate}`
      },
      statusBreakdown,
      activeBudgetLocks: activeLocksResult.rows,
      recentBudgetOperations: recentOperationsResult.rows,
      recentReimbursements: reimbursementsResult.rows
    }
  };
}

async function getOperationHistory(departmentId, limit = 100) {
  const result = await pool.query(
    `SELECT bo.*, d.name as department_name
     FROM budget_operations bo
     JOIN departments d ON bo.department_id = d.id
     WHERE bo.department_id = $1
     ORDER BY bo.created_at DESC
     LIMIT $2`,
    [departmentId, limit]
  );

  return {
    success: true,
    data: result.rows
  };
}

module.exports = {
  getDepartmentById,
  getAllDepartments,
  getDepartmentReport,
  getOperationHistory
};
