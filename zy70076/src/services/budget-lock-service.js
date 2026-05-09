const pool = require('../database/pool');
const logger = require('../utils/logger');

const LOCK_TYPES = {
  ORIGINAL: 'ORIGINAL',
  MODIFICATION: 'MODIFICATION',
  REIMBURSEMENT: 'REIMBURSEMENT'
};

async function lockBudget(client, departmentId, travelRequestId, amount, lockType) {
  if (amount <= 0) {
    return {
      success: false,
      businessCode: 'BUDGET_INVALID_AMOUNT',
      message: '锁定金额必须大于0',
      data: { requestedAmount: amount }
    };
  }

  const deptResult = await client.query(
    `SELECT id, name, total_budget, used_budget, locked_budget, available_budget, version
     FROM departments WHERE id = $1 FOR UPDATE`,
    [departmentId]
  );

  if (deptResult.rows.length === 0) {
    return {
      success: false,
      businessCode: 'DEPARTMENT_NOT_FOUND',
      message: '部门不存在',
      data: { departmentId }
    };
  }

  const dept = deptResult.rows[0];

  if (dept.available_budget < amount) {
    logger.warn('预算锁定失败：可用预算不足', {
      departmentId,
      departmentName: dept.name,
      availableBudget: dept.available_budget,
      requestedAmount: amount,
      deficit: amount - dept.available_budget
    });

    return {
      success: false,
      businessCode: 'BUDGET_INSUFFICIENT',
      message: `预算锁定失败：${dept.name}可用预算不足。当前可用：¥${dept.available_budget.toFixed(2)}，申请锁定：¥${amount.toFixed(2)}，缺口：¥${(amount - dept.available_budget).toFixed(2)}`,
      data: {
        departmentId,
        departmentName: dept.name,
        availableBudget: dept.available_budget,
        requestedAmount: amount,
        deficit: amount - dept.available_budget
      }
    };
  }

  const beforeLocked = dept.locked_budget;
  const afterLocked = dept.locked_budget + amount;
  const beforeAvailable = dept.available_budget;
  const afterAvailable = dept.available_budget - amount;

  await client.query(
    `UPDATE departments 
     SET locked_budget = $1, available_budget = $2
     WHERE id = $3 AND version = $4`,
    [afterLocked, afterAvailable, departmentId, dept.version]
  );

  const lockResult = await client.query(
    `INSERT INTO budget_locks (travel_request_id, department_id, locked_amount, lock_type, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')
     ON CONFLICT (travel_request_id, lock_type) 
     DO UPDATE SET locked_amount = $3, status = 'ACTIVE'
     RETURNING *`,
    [travelRequestId, departmentId, amount, lockType]
  );

  logger.info('预算锁定成功', {
    departmentId,
    departmentName: dept.name,
    travelRequestId,
    lockType,
    lockedAmount: amount,
    beforeLocked,
    afterLocked,
    beforeAvailable,
    afterAvailable
  });

  return {
    success: true,
    businessCode: 'BUDGET_LOCKED',
    message: `预算锁定成功：已为${dept.name}锁定¥${amount.toFixed(2)}`,
    data: {
      budgetLock: lockResult.rows[0],
      departmentBudget: {
        beforeLocked,
        afterLocked,
        beforeAvailable,
        afterAvailable
      }
    }
  };
}

async function releaseBudget(client, departmentId, travelRequestId, lockType) {
  const lockResult = await client.query(
    `SELECT * FROM budget_locks 
     WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'
     FOR UPDATE`,
    [travelRequestId, lockType]
  );

  if (lockResult.rows.length === 0) {
    logger.warn('预算释放失败：未找到激活的预算锁', {
      travelRequestId,
      lockType
    });

    return {
      success: false,
      businessCode: 'BUDGET_LOCK_NOT_FOUND',
      message: '预算释放失败：未找到激活的预算锁',
      data: { travelRequestId, lockType }
    };
  }

  const budgetLock = lockResult.rows[0];
  const releaseAmount = budgetLock.locked_amount;

  const deptResult = await client.query(
    `SELECT id, name, total_budget, used_budget, locked_budget, available_budget, version
     FROM departments WHERE id = $1 FOR UPDATE`,
    [departmentId]
  );

  if (deptResult.rows.length === 0) {
    return {
      success: false,
      businessCode: 'DEPARTMENT_NOT_FOUND',
      message: '部门不存在',
      data: { departmentId }
    };
  }

  const dept = deptResult.rows[0];
  const beforeLocked = dept.locked_budget;
  const afterLocked = Math.max(0, dept.locked_budget - releaseAmount);
  const beforeAvailable = dept.available_budget;
  const afterAvailable = dept.available_budget + releaseAmount;

  await client.query(
    `UPDATE departments 
     SET locked_budget = $1, available_budget = $2
     WHERE id = $3 AND version = $4`,
    [afterLocked, afterAvailable, departmentId, dept.version]
  );

  await client.query(
    `UPDATE budget_locks 
     SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [budgetLock.id]
  );

  logger.info('预算释放成功', {
    departmentId,
    departmentName: dept.name,
    travelRequestId,
    lockType,
    releasedAmount: releaseAmount,
    beforeLocked,
    afterLocked,
    beforeAvailable,
    afterAvailable
  });

  return {
    success: true,
    businessCode: 'BUDGET_RELEASED',
    message: `预算释放成功：已为${dept.name}释放¥${releaseAmount.toFixed(2)}`,
    data: {
      releasedAmount,
      departmentBudget: {
        beforeLocked,
        afterLocked,
        beforeAvailable,
        afterAvailable
      }
    }
  };
}

async function convertLockToUsed(client, departmentId, travelRequestId, lockType, actualAmount) {
  const lockResult = await client.query(
    `SELECT * FROM budget_locks 
     WHERE travel_request_id = $1 AND lock_type = $2 AND status = 'ACTIVE'
     FOR UPDATE`,
    [travelRequestId, lockType]
  );

  if (lockResult.rows.length === 0) {
    return {
      success: false,
      businessCode: 'BUDGET_LOCK_NOT_FOUND',
      message: '预算结算失败：未找到激活的预算锁',
      data: { travelRequestId, lockType }
    };
  }

  const budgetLock = lockResult.rows[0];
  const lockedAmount = budgetLock.locked_amount;
  const amountDifference = actualAmount - lockedAmount;
  const returnAmount = Math.max(0, lockedAmount - actualAmount);
  const additionalRequired = Math.max(0, actualAmount - lockedAmount);

  const deptResult = await client.query(
    `SELECT id, name, total_budget, used_budget, locked_budget, available_budget, version
     FROM departments WHERE id = $1 FOR UPDATE`,
    [departmentId]
  );

  if (deptResult.rows.length === 0) {
    return {
      success: false,
      businessCode: 'DEPARTMENT_NOT_FOUND',
      message: '部门不存在',
      data: { departmentId }
    };
  }

  const dept = deptResult.rows[0];

  if (additionalRequired > 0 && dept.available_budget < additionalRequired) {
    return {
      success: false,
      businessCode: 'BUDGET_INSUFFICIENT_FOR_SETTLEMENT',
      message: `预算结算失败：实际费用超出锁定金额部分需要额外预算。额外需要：¥${additionalRequired.toFixed(2)}，可用预算：¥${dept.available_budget.toFixed(2)}`,
      data: {
        lockedAmount,
        actualAmount,
        additionalRequired,
        availableBudget: dept.available_budget
      }
    };
  }

  const beforeUsed = dept.used_budget;
  const beforeLocked = dept.locked_budget;
  const beforeAvailable = dept.available_budget;

  const afterUsed = dept.used_budget + actualAmount;
  const afterLocked = dept.locked_budget - lockedAmount + additionalRequired;
  const afterAvailable = dept.available_budget - additionalRequired + returnAmount;

  await client.query(
    `UPDATE departments 
     SET used_budget = $1, locked_budget = $2, available_budget = $3
     WHERE id = $4 AND version = $5`,
    [afterUsed, afterLocked, afterAvailable, departmentId, dept.version]
  );

  await client.query(
    `UPDATE budget_locks 
     SET status = 'SETTLED', released_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [budgetLock.id]
  );

  logger.info('预算结算成功', {
    departmentId,
    departmentName: dept.name,
    travelRequestId,
    lockType,
    lockedAmount,
    actualAmount,
    amountDifference,
    returnAmount,
    additionalRequired
  });

  const message = amountDifference === 0
    ? `预算结算成功：实际费用¥${actualAmount.toFixed(2)}与锁定金额一致`
    : amountDifference > 0
      ? `预算结算成功：实际费用¥${actualAmount.toFixed(2)}，超出锁定金额¥${amountDifference.toFixed(2)}已从可用预算扣除`
      : `预算结算成功：实际费用¥${actualAmount.toFixed(2)}，节省¥${Math.abs(amountDifference).toFixed(2)}已返还至可用预算`;

  return {
    success: true,
    businessCode: 'BUDGET_SETTLED',
    message,
    data: {
      lockedAmount,
      actualAmount,
      amountDifference,
      returnAmount,
      additionalRequired,
      departmentBudget: {
        beforeUsed,
        afterUsed,
        beforeLocked,
        afterLocked,
        beforeAvailable,
        afterAvailable
      }
    }
  };
}

async function getActiveLocksByRequest(travelRequestId) {
  const result = await pool.query(
    `SELECT * FROM budget_locks 
     WHERE travel_request_id = $1 AND status = 'ACTIVE'`,
    [travelRequestId]
  );
  return result.rows;
}

module.exports = {
  LOCK_TYPES,
  lockBudget,
  releaseBudget,
  convertLockToUsed,
  getActiveLocksByRequest
};
