const pool = require('../database/pool');
const logger = require('../utils/logger');
const { lockBudget, releaseBudget, LOCK_TYPES } = require('./budget-lock-service');
const { STATUS: REQUEST_STATUS } = require('./travel-request-service');

const MODIFICATION_STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

async function createModification(requestId, newEstimatedAmount, changeReason) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT tr.*, e.name as employee_name, d.name as department_name, 
              d.available_budget, d.locked_budget
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

    if (![REQUEST_STATUS.APPROVED, REQUEST_STATUS.IN_PROGRESS].includes(request.status)) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REQUEST_INVALID_STATUS',
        message: `改签失败：出差申请状态为${request.status}，只有已批准或进行中的申请可以改签`,
        data: { requestId, currentStatus: request.status }
      };
    }

    const originalAmount = request.estimated_amount;
    const amountDifference = newEstimatedAmount - originalAmount;

    const modResult = await client.query(
      `INSERT INTO travel_modifications 
       (travel_request_id, original_estimated_amount, new_estimated_amount, 
        amount_difference, change_reason, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [requestId, originalAmount, newEstimatedAmount, amountDifference, 
       changeReason, MODIFICATION_STATUS.PENDING_APPROVAL]
    );

    const modification = modResult.rows[0];

    if (amountDifference === 0) {
      await client.query(
        `UPDATE travel_modifications 
         SET status = $1, approved_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [MODIFICATION_STATUS.APPROVED, modification.id]
      );

      await client.query('COMMIT');

      logger.info('改签申请自动批准（金额无变化）', {
        modificationId: modification.id,
        requestId,
        employeeName: request.employee_name,
        departmentName: request.department_name,
        originalAmount,
        newEstimatedAmount
      });

      return {
        success: true,
        businessCode: 'MODIFICATION_AUTO_APPROVED_NO_CHANGE',
        message: `改签申请已自动批准：申请金额无变化（¥${originalAmount.toFixed(2)}），无需调整预算`,
        data: {
          modification: {
            ...modification,
            status: MODIFICATION_STATUS.APPROVED
          }
        }
      };
    }

    if (amountDifference < 0) {
      const existingModLock = await client.query(
        `SELECT * FROM budget_locks 
         WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'`,
        [requestId, LOCK_TYPES.MODIFICATION]
      );

      let lockData = null;

      if (existingModLock.rows.length > 0) {
        const releaseResult = await releaseBudget(
          client,
          request.department_id,
          requestId,
          LOCK_TYPES.MODIFICATION
        );

        if (!releaseResult.success) {
          await client.query('ROLLBACK');
          return releaseResult;
        }
        lockData = releaseResult.data;
      }

      await client.query(
        `UPDATE travel_modifications 
         SET status = $1, approved_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [MODIFICATION_STATUS.APPROVED, modification.id]
      );

      await client.query(
        `UPDATE travel_requests SET estimated_amount = $1 WHERE id = $2`,
        [newEstimatedAmount, requestId]
      );

      await client.query('COMMIT');

      logger.info('改签申请自动批准（金额减少）', {
        modificationId: modification.id,
        requestId,
        employeeName: request.employee_name,
        departmentName: request.department_name,
        originalAmount,
        newEstimatedAmount,
        reduction: Math.abs(amountDifference)
      });

      return {
        success: true,
        businessCode: 'MODIFICATION_AUTO_APPROVED_REDUCTION',
        message: `改签申请已自动批准：预算由¥${originalAmount.toFixed(2)}调整为¥${newEstimatedAmount.toFixed(2)}，节省¥${Math.abs(amountDifference).toFixed(2)}已准备在报销时返还`,
        data: {
          modification: {
            ...modification,
            status: MODIFICATION_STATUS.APPROVED
          },
          budgetInfo: {
            originalAmount,
            newEstimatedAmount,
            reduction: Math.abs(amountDifference)
          }
        }
      };
    }

    if (amountDifference > 0) {
      if (request.available_budget >= amountDifference) {
        const lockResult = await lockBudget(
          client,
          request.department_id,
          requestId,
          amountDifference,
          LOCK_TYPES.MODIFICATION
        );

        if (!lockResult.success) {
          await client.query('ROLLBACK');
          return lockResult;
        }

        await client.query(
          `UPDATE travel_modifications 
           SET status = $1, approved_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [MODIFICATION_STATUS.APPROVED, modification.id]
        );

        await client.query(
          `UPDATE travel_requests SET estimated_amount = $1 WHERE id = $2`,
          [newEstimatedAmount, requestId]
        );

        await client.query('COMMIT');

        logger.info('改签申请自动批准（金额增加，预算充足）', {
          modificationId: modification.id,
          requestId,
          employeeName: request.employee_name,
          departmentName: request.department_name,
          originalAmount,
          newEstimatedAmount,
          additionalAmount: amountDifference
        });

        return {
          success: true,
          businessCode: 'MODIFICATION_AUTO_APPROVED_ADDITION',
          message: `改签申请已自动批准：预算由¥${originalAmount.toFixed(2)}调整为¥${newEstimatedAmount.toFixed(2)}，已额外锁定¥${amountDifference.toFixed(2)}`,
          data: {
            modification: {
              ...modification,
              status: MODIFICATION_STATUS.APPROVED
            },
            budgetLock: lockResult.data.budgetLock,
            budgetInfo: {
              originalAmount,
              newEstimatedAmount,
              additionalAmount: amountDifference
            }
          }
        };
      } else {
        await client.query('COMMIT');

        logger.warn('改签申请需人工审批（超出可用预算）', {
          modificationId: modification.id,
          requestId,
          employeeName: request.employee_name,
          departmentName: request.department_name,
          originalAmount,
          newEstimatedAmount,
          additionalRequired: amountDifference,
          availableBudget: request.available_budget,
          deficit: amountDifference - request.available_budget
        });

        return {
          success: true,
          businessCode: 'MODIFICATION_PENDING_APPROVAL',
          message: `改签申请已创建但超出预算：原预算¥${originalAmount.toFixed(2)}，新预算¥${newEstimatedAmount.toFixed(2)}，需额外¥${amountDifference.toFixed(2)}，当前可用预算¥${request.available_budget.toFixed(2)}，已转入人工审批流程`,
          data: {
            modification,
            budgetInfo: {
              originalAmount,
              newEstimatedAmount,
              additionalRequired: amountDifference,
              availableBudget: request.available_budget,
              deficit: amountDifference - request.available_budget
            }
          }
        };
      }
    }

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('创建改签申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'MODIFICATION_CREATE_FAILED',
      message: '改签申请创建失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function approveModification(modificationId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const modResult = await client.query(
      `SELECT tm.*, tr.estimated_amount as current_request_amount,
              tr.department_id, e.name as employee_name, d.name as department_name,
              d.available_budget
       FROM travel_modifications tm
       JOIN travel_requests tr ON tm.travel_request_id = tr.id
       JOIN employees e ON tr.employee_id = e.id
       JOIN departments d ON tr.department_id = d.id
       WHERE tm.id = $1 FOR UPDATE`,
      [modificationId]
    );

    if (modResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'MODIFICATION_NOT_FOUND',
        message: '改签申请不存在',
        data: { modificationId }
      };
    }

    const modification = modResult.rows[0];

    if (modification.status !== MODIFICATION_STATUS.PENDING_APPROVAL) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'MODIFICATION_INVALID_STATUS',
        message: `改签状态无效：当前状态为${modification.status}`,
        data: { modificationId, currentStatus: modification.status }
      };
    }

    if (modification.amount_difference > 0) {
      const lockResult = await lockBudget(
        client,
        modification.department_id,
        modification.travel_request_id,
        modification.amount_difference,
        LOCK_TYPES.MODIFICATION
      );

      if (!lockResult.success) {
        await client.query('ROLLBACK');
        return lockResult;
      }
    }

    await client.query(
      `UPDATE travel_modifications 
       SET status = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [MODIFICATION_STATUS.APPROVED, modificationId]
    );

    await client.query(
      `UPDATE travel_requests SET estimated_amount = $1 WHERE id = $2`,
      [modification.new_estimated_amount, modification.travel_request_id]
    );

    await client.query('COMMIT');

    logger.info('改签申请人工批准', {
      modificationId,
      requestId: modification.travel_request_id,
      employeeName: modification.employee_name,
      departmentName: modification.department_name,
      originalAmount: modification.original_estimated_amount,
      newEstimatedAmount: modification.new_estimated_amount,
      amountDifference: modification.amount_difference
    });

    return {
      success: true,
      businessCode: 'MODIFICATION_APPROVED',
      message: `改签申请已批准：${modification.employee_name}的出差预算由¥${modification.original_estimated_amount.toFixed(2)}调整为¥${modification.new_estimated_amount.toFixed(2)}`,
      data: {
        modification: {
          ...modification,
          status: MODIFICATION_STATUS.APPROVED
        }
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('批准改签申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'MODIFICATION_APPROVE_FAILED',
      message: '改签申请批准失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function getModificationsByRequest(requestId) {
  const result = await pool.query(
    `SELECT * FROM travel_modifications 
     WHERE travel_request_id = $1 
     ORDER BY created_at DESC`,
    [requestId]
  );

  return {
    success: true,
    data: result.rows
  };
}

module.exports = {
  MODIFICATION_STATUS,
  createModification,
  approveModification,
  getModificationsByRequest
};
