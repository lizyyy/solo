const pool = require('../database/pool');
const logger = require('../utils/logger');
const { lockBudget, releaseBudget, LOCK_TYPES } = require('./budget-lock-service');

const STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

async function createTravelRequest(requestData) {
  const {
    employeeId,
    purpose,
    destination,
    startDate,
    endDate,
    estimatedAmount
  } = requestData;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const empResult = await client.query(
      `SELECT e.id, e.name, e.department_id, d.name as department_name, d.available_budget
       FROM employees e
       JOIN departments d ON e.department_id = d.id
       WHERE e.id = $1`,
      [employeeId]
    );

    if (empResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'EMPLOYEE_NOT_FOUND',
        message: '员工不存在',
        data: { employeeId }
      };
    }

    const employee = empResult.rows[0];
    const departmentId = employee.department_id;
    const departmentName = employee.department_name;

    const requestResult = await client.query(
      `INSERT INTO travel_requests 
       (employee_id, department_id, purpose, destination, start_date, end_date, estimated_amount, status, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [employeeId, departmentId, purpose, destination, startDate, endDate, estimatedAmount, 
       STATUS.PENDING_APPROVAL, 'PENDING']
    );

    const travelRequest = requestResult.rows[0];

    if (employee.available_budget >= estimatedAmount) {
      const lockResult = await lockBudget(
        client, 
        departmentId, 
        travelRequest.id, 
        estimatedAmount, 
        LOCK_TYPES.ORIGINAL
      );

      if (!lockResult.success) {
        await client.query('ROLLBACK');
        return lockResult;
      }

      await client.query(
        `UPDATE travel_requests 
         SET status = $1, exceeds_budget = $2
         WHERE id = $3`,
        [STATUS.APPROVED, false, travelRequest.id]
      );

      await client.query('COMMIT');

      logger.info('出差申请创建并自动批准（预算充足）', {
        requestId: travelRequest.id,
        employeeId,
        employeeName: employee.name,
        departmentId,
        departmentName,
        estimatedAmount,
        budgetStatus: 'AUTO_APPROVED'
      });

      return {
        success: true,
        businessCode: 'REQUEST_CREATED_AUTO_APPROVED',
        message: `出差申请已创建并自动批准：${employee.name}前往${destination}，预算锁定¥${estimatedAmount.toFixed(2)}`,
        data: {
          travelRequest: {
            ...travelRequest,
            status: STATUS.APPROVED
          },
          budgetLock: lockResult.data.budgetLock,
          departmentBudget: lockResult.data.departmentBudget
        }
      };
    } else {
      await client.query(
        `UPDATE travel_requests SET exceeds_budget = $1 WHERE id = $2`,
        [true, travelRequest.id]
      );

      await client.query('COMMIT');

      logger.warn('出差申请创建但超出预算，需人工审批', {
        requestId: travelRequest.id,
        employeeId,
        employeeName: employee.name,
        departmentId,
        departmentName,
        estimatedAmount,
        availableBudget: employee.available_budget,
        deficit: estimatedAmount - employee.available_budget
      });

      return {
        success: true,
        businessCode: 'REQUEST_CREATED_EXCEEDS_BUDGET',
        message: `出差申请已创建但超出预算：${employee.name}前往${destination}，申请金额¥${estimatedAmount.toFixed(2)}，可用预算¥${employee.available_budget.toFixed(2)}，已转入人工审批流程`,
        data: {
          travelRequest: {
            ...travelRequest,
            exceeds_budget: true
          },
          budgetInfo: {
            requested: estimatedAmount,
            available: employee.available_budget,
            deficit: estimatedAmount - employee.available_budget
          }
        }
      };
    }

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('创建出差申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'REQUEST_CREATE_FAILED',
      message: '出差申请创建失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function approveTravelRequest(requestId, approverInfo) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT tr.*, e.name as employee_name, d.name as department_name, d.available_budget
       FROM travel_requests tr
       JOIN employees e ON tr.employee_id = e.id
       JOIN departments d ON tr.department_id = d.id
       WHERE tr.id = $1 FOR UPDATE`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REQUEST_NOT_FOUND',
        message: '出差申请不存在',
        data: { requestId }
      };
    }

    const request = requestResult.rows[0];

    if (request.status !== STATUS.PENDING_APPROVAL) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REQUEST_INVALID_STATUS',
        message: `出差申请状态无效：当前状态为${request.status}，无法审批`,
        data: { requestId, currentStatus: request.status }
      };
    }

    const lockResult = await lockBudget(
      client,
      request.department_id,
      request.id,
      request.estimated_amount,
      LOCK_TYPES.ORIGINAL
    );

    if (!lockResult.success) {
      await client.query('ROLLBACK');
      return lockResult;
    }

    await client.query(
      `UPDATE travel_requests 
       SET status = $1, approval_status = $2, exceeds_budget = $3
       WHERE id = $4`,
      [STATUS.APPROVED, 'APPROVED', false, requestId]
    );

    await client.query('COMMIT');

    logger.info('出差申请人工批准', {
      requestId,
      employeeName: request.employee_name,
      departmentName: request.department_name,
      estimatedAmount: request.estimated_amount,
      approver: approverInfo
    });

    return {
      success: true,
      businessCode: 'REQUEST_APPROVED',
      message: `出差申请已批准：${request.employee_name}前往${request.destination}，预算锁定¥${request.estimated_amount.toFixed(2)}`,
      data: {
        travelRequest: {
          ...request,
          status: STATUS.APPROVED,
          approval_status: 'APPROVED'
        },
        budgetLock: lockResult.data.budgetLock,
        departmentBudget: lockResult.data.departmentBudget
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('批准出差申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'REQUEST_APPROVE_FAILED',
      message: '出差申请批准失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function cancelTravelRequest(requestId, reason) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT tr.*, e.name as employee_name, d.name as department_name
       FROM travel_requests tr
       JOIN employees e ON tr.employee_id = e.id
       JOIN departments d ON tr.department_id = d.id
       WHERE tr.id = $1 FOR UPDATE`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REQUEST_NOT_FOUND',
        message: '出差申请不存在',
        data: { requestId }
      };
    }

    const request = requestResult.rows[0];

    if ([STATUS.COMPLETED, STATUS.CANCELLED].includes(request.status)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REQUEST_INVALID_STATUS',
        message: `出差申请状态无效：当前状态为${request.status}，无法取消`,
        data: { requestId, currentStatus: request.status }
      };
    }

    const existingLock = await client.query(
      `SELECT * FROM budget_locks 
       WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'`,
      [requestId, LOCK_TYPES.ORIGINAL]
    );

    if (existingLock.rows.length > 0) {
      const releaseResult = await releaseBudget(
        client,
        request.department_id,
        request.id,
        LOCK_TYPES.ORIGINAL
      );

      if (!releaseResult.success) {
        await client.query('ROLLBACK');
        return releaseResult;
      }
    }

    const modLockResult = await client.query(
      `SELECT * FROM budget_locks 
       WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'`,
      [requestId, LOCK_TYPES.MODIFICATION]
    );

    if (modLockResult.rows.length > 0) {
      const modReleaseResult = await releaseBudget(
        client,
        request.department_id,
        request.id,
        LOCK_TYPES.MODIFICATION
      );

      if (!modReleaseResult.success) {
        await client.query('ROLLBACK');
        return modReleaseResult;
      }
    }

    await client.query(
      `UPDATE travel_requests SET status = $1 WHERE id = $2`,
      [STATUS.CANCELLED, requestId]
    );

    await client.query('COMMIT');

    logger.info('出差申请已取消', {
      requestId,
      employeeName: request.employee_name,
      departmentName: request.department_name,
      reason
    });

    return {
      success: true,
      businessCode: 'REQUEST_CANCELLED',
      message: `出差申请已取消：${request.employee_name}前往${request.destination}的申请已撤销，锁定预算已释放`,
      data: {
        travelRequest: {
          ...request,
          status: STATUS.CANCELLED
        }
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('取消出差申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'REQUEST_CANCEL_FAILED',
      message: '出差申请取消失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function getTravelRequestById(requestId) {
  const result = await pool.query(
    `SELECT tr.*, e.name as employee_name, d.name as department_name
     FROM travel_requests tr
     JOIN employees e ON tr.employee_id = e.id
     JOIN departments d ON tr.department_id = d.id
     WHERE tr.id = $1`,
    [requestId]
  );

  if (result.rows.length === 0) {
    return {
      success: false,
      businessCode: 'REQUEST_NOT_FOUND',
      message: '出差申请不存在',
      data: { requestId }
    };
  }

  return {
    success: true,
    data: result.rows[0]
  };
}

async function listTravelRequests(filters = {}) {
  let query = `
    SELECT tr.*, e.name as employee_name, d.name as department_name
    FROM travel_requests tr
    JOIN employees e ON tr.employee_id = e.id
    JOIN departments d ON tr.department_id = d.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (filters.employeeId) {
    query += ` AND tr.employee_id = $${paramIndex++}`;
    params.push(filters.employeeId);
  }

  if (filters.departmentId) {
    query += ` AND tr.department_id = $${paramIndex++}`;
    params.push(filters.departmentId);
  }

  if (filters.status) {
    query += ` AND tr.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  query += ' ORDER BY tr.created_at DESC';

  const result = await pool.query(query, params);

  return {
    success: true,
    data: result.rows
  };
}

module.exports = {
  STATUS,
  createTravelRequest,
  approveTravelRequest,
  cancelTravelRequest,
  getTravelRequestById,
  listTravelRequests
};
