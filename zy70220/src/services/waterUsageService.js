const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const { recordHistory } = require('../utils/history');
const waterTankService = require('./waterTankService');
const stayService = require('./stayService');
const { 
  ValidationError, 
  ResourceNotFoundError, 
  ConflictError,
  InvalidStateTransitionError,
  WaterQuotaExceededError,
  requireFields
} = require('../utils/errors');

const LAUNDRY_WATER_PER_LOAD = 30;
const POOL_REFILL_MIN = 100;

const getUsage = (usageId) => {
  const usage = db.prepare('SELECT * FROM water_usages WHERE id = ?').get(usageId);
  if (!usage) {
    throw new ResourceNotFoundError(`用水记录不存在: ${usageId}`);
  }
  return usage;
};

const getUsageByRoom = (roomNumber) => {
  return db.prepare(`
    SELECT * FROM water_usages 
    WHERE room_number = ?
    ORDER BY created_at DESC
  `).all(roomNumber);
};

const getUsageByStay = (stayId) => {
  return db.prepare(`
    SELECT * FROM water_usages 
    WHERE stay_id = ?
    ORDER BY created_at DESC
  `).all(stayId);
};

const getAllUsages = (status = null) => {
  if (status) {
    return db.prepare(`
      SELECT * FROM water_usages 
      WHERE status = ?
      ORDER BY created_at DESC
    `).all(status);
  }
  return db.prepare(`
    SELECT * FROM water_usages 
    ORDER BY created_at DESC
  `).all();
};

const validateUsageType = (type) => {
  const validTypes = Object.values(config.USAGE_TYPES);
  if (!validTypes.includes(type)) {
    throw new ValidationError(
      `无效的用水类型 '${type}'，有效值: ${validTypes.join(', ')}`,
      'usage_type'
    );
  }
};

const checkDuplicateSubmission = (stayId, usageType, amount, timeWindowMinutes = 1) => {
  const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
  
  const existing = db.prepare(`
    SELECT * FROM water_usages 
    WHERE stay_id = ? 
      AND usage_type = ? 
      AND amount = ?
      AND status = ?
      AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(stayId, usageType, amount, config.USAGE_STATUS.VALID, cutoffTime);

  return existing;
};

const recordLaundryUsage = (stayId, loadCount = 1, operator = 'system') => {
  if (loadCount <= 0 || !Number.isInteger(loadCount)) {
    throw new ValidationError('洗衣次数必须是正整数', 'load_count');
  }

  const stay = stayService.getStay(stayId);
  
  if (stay.status !== config.STAY_STATUS.ACTIVE) {
    throw new InvalidStateTransitionError(
      '只能为活跃状态的入住记录记录用水',
      stay.status,
      null
    );
  }

  const amount = loadCount * LAUNDRY_WATER_PER_LOAD;
  
  const duplicate = checkDuplicateSubmission(stayId, config.USAGE_TYPES.LAUNDRY, amount);
  if (duplicate) {
    throw new ConflictError(
      `检测到重复提交: 该入住记录在1分钟内已有相同的洗衣用水记录 (ID: ${duplicate.id})`
    );
  }

  const tankStatus = waterTankService.getTankStatus();
  if (tankStatus.current_level < amount) {
    throw new WaterQuotaExceededError(
      '水箱水量不足',
      {
        tank_current: tankStatus.current_level,
        required: amount,
        deficit: amount - tankStatus.current_level
      }
    );
  }

  const usageId = uuidv4();
  const now = new Date().toISOString();
  const usage = {
    id: usageId,
    stay_id: stayId,
    room_number: stay.room_number,
    usage_type: config.USAGE_TYPES.LAUNDRY,
    amount,
    description: `洗衣用水 - ${loadCount}次 × ${LAUNDRY_WATER_PER_LOAD}L/次`,
    status: config.USAGE_STATUS.VALID,
    is_manual_correction: 0,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO water_usages (id, stay_id, room_number, usage_type, amount, description, status, is_manual_correction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    usage.id,
    usage.stay_id,
    usage.room_number,
    usage.usage_type,
    usage.amount,
    usage.description,
    usage.status,
    usage.is_manual_correction,
    usage.created_at,
    usage.updated_at
  );

  waterTankService.consumeWater(amount, usageId);

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.CREATE,
    null,
    usage,
    '记录洗衣用水',
    operator
  );

  return {
    success: true,
    usage,
    tank_before: tankStatus.current_level,
    tank_after: tankStatus.current_level - amount
  };
};

const recordPoolRefill = (amount, reason = '泳池补水', operator = 'system') => {
  if (amount < POOL_REFILL_MIN) {
    throw new ValidationError(`泳池补水量最少为 ${POOL_REFILL_MIN}L`, 'amount');
  }

  const tankStatus = waterTankService.getTankStatus();
  if (tankStatus.current_level < amount) {
    throw new WaterQuotaExceededError(
      '水箱水量不足，无法完成泳池补水',
      {
        tank_current: tankStatus.current_level,
        required: amount,
        deficit: amount - tankStatus.current_level
      }
    );
  }

  const duplicate = checkDuplicateSubmission(null, config.USAGE_TYPES.POOL_REFILL, amount);
  if (duplicate) {
    throw new ConflictError(
      `检测到重复提交: 在1分钟内已有相同的泳池补水记录 (ID: ${duplicate.id})`
    );
  }

  const usageId = uuidv4();
  const now = new Date().toISOString();
  const usage = {
    id: usageId,
    stay_id: null,
    room_number: null,
    usage_type: config.USAGE_TYPES.POOL_REFILL,
    amount,
    description: reason || '泳池补水',
    status: config.USAGE_STATUS.VALID,
    is_manual_correction: 0,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO water_usages (id, stay_id, room_number, usage_type, amount, description, status, is_manual_correction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    usage.id,
    usage.stay_id,
    usage.room_number,
    usage.usage_type,
    usage.amount,
    usage.description,
    usage.status,
    usage.is_manual_correction,
    usage.created_at,
    usage.updated_at
  );

  waterTankService.consumeWater(amount, usageId);

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.CREATE,
    null,
    usage,
    reason || '泳池补水',
    operator
  );

  return {
    success: true,
    usage,
    tank_before: tankStatus.current_level,
    tank_after: tankStatus.current_level - amount
  };
};

const recordOtherUsage = (stayId, amount, description, operator = 'system') => {
  requireFields({ amount, description }, ['amount', 'description']);

  if (amount <= 0) {
    throw new ValidationError('用水量必须大于0', 'amount');
  }

  const stay = stayService.getStay(stayId);
  
  if (stay.status !== config.STAY_STATUS.ACTIVE) {
    throw new InvalidStateTransitionError(
      '只能为活跃状态的入住记录记录用水',
      stay.status,
      null
    );
  }

  const tankStatus = waterTankService.getTankStatus();
  if (tankStatus.current_level < amount) {
    throw new WaterQuotaExceededError(
      '水箱水量不足',
      {
        tank_current: tankStatus.current_level,
        required: amount,
        deficit: amount - tankStatus.current_level
      }
    );
  }

  const duplicate = checkDuplicateSubmission(stayId, config.USAGE_TYPES.OTHER, amount);
  if (duplicate) {
    throw new ConflictError(
      `检测到重复提交: 该入住记录在1分钟内已有相同的其他用水记录 (ID: ${duplicate.id})`
    );
  }

  const usageId = uuidv4();
  const now = new Date().toISOString();
  const usage = {
    id: usageId,
    stay_id: stayId,
    room_number: stay.room_number,
    usage_type: config.USAGE_TYPES.OTHER,
    amount,
    description,
    status: config.USAGE_STATUS.VALID,
    is_manual_correction: 0,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO water_usages (id, stay_id, room_number, usage_type, amount, description, status, is_manual_correction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    usage.id,
    usage.stay_id,
    usage.room_number,
    usage.usage_type,
    usage.amount,
    usage.description,
    usage.status,
    usage.is_manual_correction,
    usage.created_at,
    usage.updated_at
  );

  waterTankService.consumeWater(amount, usageId);

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.CREATE,
    null,
    usage,
    description,
    operator
  );

  return {
    success: true,
    usage,
    tank_before: tankStatus.current_level,
    tank_after: tankStatus.current_level - amount
  };
};

const revokeUsage = (usageId, reason, operator = 'system') => {
  if (!reason || reason.trim() === '') {
    throw new ValidationError('撤回原因不能为空', 'reason');
  }

  const usage = getUsage(usageId);

  if (usage.status === config.USAGE_STATUS.REVOKED) {
    throw new InvalidStateTransitionError(
      '该记录已被撤回',
      usage.status,
      config.USAGE_STATUS.REVOKED
    );
  }

  if (usage.status === config.USAGE_STATUS.CORRECTED) {
    throw new InvalidStateTransitionError(
      '已修正的记录不能被撤回',
      usage.status,
      config.USAGE_STATUS.REVOKED
    );
  }

  if (usage.usage_type === config.USAGE_TYPES.CHECKIN_BASIC) {
    throw new ConflictError('入住基本配额不能单独撤回，如需取消请使用取消入住功能');
  }

  const beforeState = { ...usage };
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE water_usages 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(config.USAGE_STATUS.REVOKED, now, usageId);

  const afterState = { ...usage, status: config.USAGE_STATUS.REVOKED, updated_at: now };

  waterTankService.restoreWater(usage.amount, reason, usageId);

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.REVOKE,
    beforeState,
    afterState,
    reason,
    operator
  );

  return {
    success: true,
    usage: getUsage(usageId),
    restored_amount: usage.amount
  };
};

const correctUsage = (usageId, newAmount, reason, operator = 'system') => {
  requireFields({ new_amount: newAmount, reason }, ['new_amount', 'reason']);

  if (newAmount <= 0) {
    throw new ValidationError('修正后的水量必须大于0', 'new_amount');
  }

  const usage = getUsage(usageId);

  if (usage.status === config.USAGE_STATUS.REVOKED) {
    throw new InvalidStateTransitionError(
      '已撤回的记录不能被修正',
      usage.status,
      config.USAGE_STATUS.CORRECTED
    );
  }

  if (usage.usage_type === config.USAGE_TYPES.CHECKIN_BASIC) {
    throw new ConflictError('入住基本配额不能单独修正，如需调整请修改入住人数');
  }

  const amountDiff = newAmount - usage.amount;
  const tankStatus = waterTankService.getTankStatus();

  if (amountDiff > 0 && tankStatus.current_level < amountDiff) {
    throw new WaterQuotaExceededError(
      '水箱水量不足，无法增加用量',
      {
        tank_current: tankStatus.current_level,
        required_additional: amountDiff,
        deficit: amountDiff - tankStatus.current_level
      }
    );
  }

  const beforeState = { ...usage };
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE water_usages 
    SET amount = ?, status = ?, is_manual_correction = 1, updated_at = ?
    WHERE id = ?
  `).run(newAmount, config.USAGE_STATUS.CORRECTED, now, usageId);

  if (amountDiff > 0) {
    waterTankService.consumeWater(amountDiff, usageId);
  } else if (amountDiff < 0) {
    waterTankService.restoreWater(Math.abs(amountDiff), '用量修正退还', usageId);
  }

  const afterState = { 
    ...usage, 
    amount: newAmount, 
    status: config.USAGE_STATUS.CORRECTED,
    is_manual_correction: 1,
    updated_at: now 
  };

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.CORRECT,
    beforeState,
    afterState,
    `${reason} (原: ${usage.amount}L → 新: ${newAmount}L)`,
    operator
  );

  return {
    success: true,
    usage: getUsage(usageId),
    amount_change: amountDiff,
    original_amount: usage.amount,
    new_amount: newAmount
  };
};

module.exports = {
  getUsage,
  getUsageByRoom,
  getUsageByStay,
  getAllUsages,
  validateUsageType,
  recordLaundryUsage,
  recordPoolRefill,
  recordOtherUsage,
  revokeUsage,
  correctUsage,
  LAUNDRY_WATER_PER_LOAD,
  POOL_REFILL_MIN
};
