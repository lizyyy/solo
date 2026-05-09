const pool = require('../database/pool');
const logger = require('../utils/logger');
const { convertLockToUsed, releaseBudget, LOCK_TYPES } = require('./budget-lock-service');

const REIMBURSEMENT_STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SETTLED: 'SETTLED',
  REJECTED: 'REJECTED'
};

async function createReimbursement(requestId, actualAmount) {
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

    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      const existingReimbursement = await client.query(
        `SELECT * FROM reimbursements 
         WHERE travel_request_id = $1 AND status IN ($2, $3)`,
        [requestId, REIMBURSEMENT_STATUS.SETTLED, REIMBURSEMENT_STATUS.APPROVED]
      );

      if (existingReimbursement.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          businessCode: 'REIMBURSEMENT_ALREADY_EXISTS',
          message: `该出差申请已存在报销记录，状态：${existingReimbursement.rows[0].status}`,
          data: { requestId, existingStatus: existingReimbursement.rows[0].status }
        };
      }
    }

    if (actualAmount <= 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'INVALID_AMOUNT',
        message: '报销金额必须大于0',
        data: { actualAmount }
      };
    }

    const estimatedAmount = request.estimated_amount;
    const amountDifference = actualAmount - estimatedAmount;

    const reimbResult = await client.query(
      `INSERT INTO reimbursements 
       (travel_request_id, employee_id, department_id, estimated_amount, 
        actual_amount, amount_difference, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [requestId, request.employee_id, request.department_id, estimatedAmount,
       actualAmount, amountDifference, REIMBURSEMENT_STATUS.PENDING_APPROVAL]
    );

    const reimbursement = reimbResult.rows[0];

    await client.query('COMMIT');

    logger.info('报销申请已创建', {
      reimbursementId: reimbursement.id,
      requestId,
      employeeName: request.employee_name,
      departmentName: request.department_name,
      estimatedAmount,
      actualAmount,
      amountDifference
    });

    const diffMessage = amountDifference === 0
      ? '与预算一致'
      : amountDifference > 0
        ? `超支¥${amountDifference.toFixed(2)}`
        : `节省¥${Math.abs(amountDifference).toFixed(2)}`;

    return {
      success: true,
      businessCode: 'REIMBURSEMENT_CREATED',
      message: `报销申请已创建：${request.employee_name}的出差报销，预算¥${estimatedAmount.toFixed(2)}，实际¥${actualAmount.toFixed(2)}（${diffMessage}）`,
      data: {
        reimbursement,
        budgetInfo: {
          estimatedAmount,
          actualAmount,
          amountDifference
        }
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('创建报销申请失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'REIMBURSEMENT_CREATE_FAILED',
      message: '报销申请创建失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function settleReimbursement(reimbursementId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reimbResult = await client.query(
      `SELECT r.*, tr.status as request_status, e.name as employee_name, 
              d.name as department_name
       FROM reimbursements r
       JOIN travel_requests tr ON r.travel_request_id = tr.id
       JOIN employees e ON r.employee_id = e.id
       JOIN departments d ON r.department_id = d.id
       WHERE r.id = $1 FOR UPDATE`,
      [reimbursementId]
    );

    if (reimbResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REIMBURSEMENT_NOT_FOUND',
        message: '报销申请不存在',
        data: { reimbursementId }
      };
    }

    const reimbursement = reimbResult.rows[0];

    if (reimbursement.status !== REIMBURSEMENT_STATUS.PENDING_APPROVAL) {
      await client.query('ROLLBACK');
      return {
        success: false,
        businessCode: 'REIMBURSEMENT_INVALID_STATUS',
        message: `报销状态无效：当前状态为${reimbursement.status}，无法结算`,
        data: { reimbursementId, currentStatus: reimbursement.status }
      };
    }

    const actualAmount = reimbursement.actual_amount;
    const estimatedAmount = reimbursement.estimated_amount;

    const originalLockResult = await client.query(
      `SELECT * FROM budget_locks 
       WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'`,
      [reimbursement.travel_request_id, LOCK_TYPES.ORIGINAL]
    );

    const modLockResult = await client.query(
      `SELECT * FROM budget_locks 
       WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'`,
      [reimbursement.travel_request_id, LOCK_TYPES.MODIFICATION]
    );

    const lockedAmount = (originalLockResult.rows[0]?.locked_amount || 0) + 
                         (modLockResult.rows[0]?.locked_amount || 0);

    let settledAmount = 0;
    let budgetChanges = {
      beforeUsed: 0,
      afterUsed: 0,
      beforeLocked: 0,
      afterLocked: 0,
      beforeAvailable: 0,
      afterAvailable: 0
    };

    if (originalLockResult.rows.length > 0) {
      const settleOriginal = await convertLockToUsed(
        client,
        reimbursement.department_id,
        reimbursement.travel_request_id,
        LOCK_TYPES.ORIGINAL,
        Math.min(actualAmount, originalLockResult.rows[0].locked_amount)
      );

      if (!settleOriginal.success) {
        await client.query('ROLLBACK');
        return settleOriginal;
      }

      settledAmount += settleOriginal.data.actualAmount;
      budgetChanges = {
        ...budgetChanges,
        ...settleOriginal.data.departmentBudget
      };
    }

    if (modLockResult.rows.length > 0 && actualAmount > originalLockResult.rows[0]?.locked_amount) {
      const remainingAmount = actualAmount - (originalLockResult.rows[0]?.locked_amount || 0);
      const settleMod = await convertLockToUsed(
        client,
        reimbursement.department_id,
        reimbursement.travel_request_id,
        LOCK_TYPES.MODIFICATION,
        Math.min(remainingAmount, modLockResult.rows[0].locked_amount)
      );

      if (!settleMod.success) {
        await client.query('ROLLBACK');
        return settleMod;
      }

      settledAmount += settleMod.data.actualAmount;
    }

    const remainingOriginal = originalLockResult.rows.length > 0 
      ? originalLockResult.rows[0].locked_amount - Math.min(actualAmount, originalLockResult.rows[0].locked_amount)
      : 0;

    const remainingMod = modLockResult.rows.length > 0 && actualAmount > originalLockResult.rows[0]?.locked_amount
      ? modLockResult.rows[0].locked_amount - Math.min(actualAmount - originalLockResult.rows[0].locked_amount, modLockResult.rows[0].locked_amount)
      : (modLockResult.rows.length > 0 ? modLockResult.rows[0].locked_amount : 0);

    if (remainingOriginal > 0) {
      const releaseResult = await releaseBudget(
        client,
        reimbursement.department_id,
        reimbursement.travel_request_id,
        LOCK_TYPES.ORIGINAL
      );

      if (!releaseResult.success && releaseResult.businessCode !== 'BUDGET_LOCK_NOT_FOUND') {
        await client.query('ROLLBACK');
        return releaseResult;
      }
    }

    if (remainingMod > 0) {
      const releaseResult = await releaseBudget(
        client,
        reimbursement.department_id,
        reimbursement.travel_request_id,
        LOCK_TYPES.MODIFICATION
      );

      if (!releaseResult.success && releaseResult.businessCode !== 'BUDGET_LOCK_NOT_FOUND') {
        await client.query('ROLLBACK');
        return releaseResult;
      }
    }

    await client.query(
      `UPDATE reimbursements 
       SET status = $1, settled_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [REIMBURSEMENT_STATUS.SETTLED, reimbursementId]
    );

    await client.query(
      `UPDATE travel_requests SET status = $1 WHERE id = $2`,
      ['COMPLETED', reimbursement.travel_request_id]
    );

    await client.query('COMMIT');

    const amountDifference = actualAmount - estimatedAmount;
    const diffMessage = amountDifference === 0
      ? '与预算一致'
      : amountDifference > 0
        ? `超支¥${amountDifference.toFixed(2)}`
        : `节省¥${Math.abs(amountDifference).toFixed(2)}已返还`;

    logger.info('报销结算成功', {
      reimbursementId,
      requestId: reimbursement.travel_request_id,
      employeeName: reimbursement.employee_name,
      departmentName: reimbursement.department_name,
      estimatedAmount,
      actualAmount,
      amountDifference
    });

    return {
      success: true,
      businessCode: 'REIMBURSEMENT_SETTLED',
      message: `报销结算成功：${reimbursement.employee_name}的出差报销已结算，预算¥${estimatedAmount.toFixed(2)}，实际¥${actualAmount.toFixed(2)}（${diffMessage}）`,
      data: {
        reimbursement: {
          ...reimbursement,
          status: REIMBURSEMENT_STATUS.SETTLED
        },
        budgetInfo: {
          estimatedAmount,
          actualAmount,
          amountDifference,
          settledAmount
        }
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('报销结算失败', { error: error.message });
    
    return {
      success: false,
      businessCode: 'REIMBURSEMENT_SETTLE_FAILED',
      message: '报销结算失败：系统错误',
      data: { error: error.message }
    };
  } finally {
    client.release();
  }
}

async function getReimbursementsByRequest(requestId) {
  const result = await pool.query(
    `SELECT * FROM reimbursements 
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
  REIMBURSEMENT_STATUS,
  createReimbursement,
  settleReimbursement,
  getReimbursementsByRequest
};
