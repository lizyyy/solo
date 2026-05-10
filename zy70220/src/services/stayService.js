const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const { recordHistory } = require('../utils/history');
const waterTankService = require('./waterTankService');
const { 
  ValidationError, 
  ResourceNotFoundError, 
  ConflictError,
  InvalidStateTransitionError,
  WaterQuotaExceededError,
  requireFields
} = require('../utils/errors');

const BASIC_WATER_PER_PERSON = 50;

const calculateBasicWater = (guestCount) => {
  return guestCount * BASIC_WATER_PER_PERSON;
};

const checkRoomAvailability = (roomNumber) => {
  const activeStay = db.prepare(`
    SELECT * FROM room_stays 
    WHERE room_number = ? AND status = ?
  `).get(roomNumber, config.STAY_STATUS.ACTIVE);
  
  return !activeStay;
};

const getStay = (stayId) => {
  const stay = db.prepare('SELECT * FROM room_stays WHERE id = ?').get(stayId);
  if (!stay) {
    throw new ResourceNotFoundError(`入住记录不存在: ${stayId}`);
  }
  return stay;
};

const getStayWithUsage = (stayId) => {
  const stay = getStay(stayId);
  const usages = db.prepare(`
    SELECT * FROM water_usages 
    WHERE stay_id = ? AND status = ?
    ORDER BY created_at DESC
  `).all(stayId, config.USAGE_STATUS.VALID);

  const totalUsage = usages.reduce((sum, u) => sum + u.amount, 0);

  return {
    ...stay,
    usages,
    total_water_used: totalUsage,
    remaining_quota: Math.max(0, stay.basic_water_allocated - totalUsage)
  };
};

const getAllActiveStays = () => {
  const stays = db.prepare(`
    SELECT * FROM room_stays 
    WHERE status = ?
    ORDER BY check_in_time DESC
  `).all(config.STAY_STATUS.ACTIVE);

  return stays.map(stay => {
    const usages = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM water_usages 
      WHERE stay_id = ? AND status = ?
    `).get(stay.id, config.USAGE_STATUS.VALID);

    return {
      ...stay,
      total_usage: usages.total,
      remaining_quota: Math.max(0, stay.basic_water_allocated - usages.total)
    };
  });
};

const checkIn = (roomNumber, guestCount, checkInTime = null, operator = 'system') => {
  requireFields({ room_number: roomNumber, guest_count: guestCount }, ['room_number', 'guest_count']);

  if (!checkRoomAvailability(roomNumber)) {
    throw new ConflictError(`房间 ${roomNumber} 当前已有人入住`);
  }

  if (guestCount <= 0 || !Number.isInteger(guestCount)) {
    throw new ValidationError('入住人数必须是正整数', 'guest_count');
  }

  const basicWater = calculateBasicWater(guestCount);
  const tankStatus = waterTankService.getTankStatus();

  if (tankStatus.current_level < basicWater) {
    throw new WaterQuotaExceededError(
      '水箱水量不足，无法满足入住基本配额',
      {
        tank_current: tankStatus.current_level,
        required: basicWater,
        deficit: basicWater - tankStatus.current_level
      }
    );
  }

  const stayId = uuidv4();
  const now = checkInTime || new Date().toISOString();

  const stay = {
    id: stayId,
    room_number: roomNumber,
    guest_count: guestCount,
    check_in_time: now,
    check_out_time: null,
    status: config.STAY_STATUS.ACTIVE,
    basic_water_allocated: basicWater,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO room_stays (id, room_number, guest_count, check_in_time, check_out_time, status, basic_water_allocated, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    stay.id,
    stay.room_number,
    stay.guest_count,
    stay.check_in_time,
    stay.check_out_time,
    stay.status,
    stay.basic_water_allocated,
    stay.created_at,
    stay.updated_at
  );

  recordHistory(
    'room_stay',
    stayId,
    config.OPERATION_TYPES.CREATE,
    null,
    stay,
    '办理入住',
    operator
  );

  const usageId = uuidv4();
  const usage = {
    id: usageId,
    stay_id: stayId,
    room_number: roomNumber,
    usage_type: config.USAGE_TYPES.CHECKIN_BASIC,
    amount: basicWater,
    description: `入住基本配额 - ${guestCount}人 × 50L/人`,
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

  waterTankService.consumeWater(basicWater, usageId);

  recordHistory(
    'water_usage',
    usageId,
    config.OPERATION_TYPES.CREATE,
    null,
    usage,
    '入住基本配额扣除',
    operator
  );

  return {
    success: true,
    stay: getStayWithUsage(stayId),
    basic_water_allocated: basicWater
  };
};

const checkOut = (stayId, checkOutTime = null, operator = 'system') => {
  const stay = getStay(stayId);

  if (stay.status !== config.STAY_STATUS.ACTIVE) {
    throw new InvalidStateTransitionError(
      '无法对非活跃状态的入住记录执行退房',
      stay.status,
      config.STAY_STATUS.CHECKED_OUT
    );
  }

  const beforeState = { ...stay };
  const now = checkOutTime || new Date().toISOString();

  db.prepare(`
    UPDATE room_stays 
    SET status = ?, check_out_time = ?, updated_at = ?
    WHERE id = ?
  `).run(config.STAY_STATUS.CHECKED_OUT, now, now, stayId);

  const afterState = { 
    ...stay, 
    status: config.STAY_STATUS.CHECKED_OUT, 
    check_out_time: now, 
    updated_at: now 
  };

  recordHistory(
    'room_stay',
    stayId,
    config.OPERATION_TYPES.CHECKOUT,
    beforeState,
    afterState,
    '办理退房',
    operator
  );

  return {
    success: true,
    stay: getStay(stayId),
    checked_out_at: now
  };
};

const updateStay = (stayId, updates, operator = 'system') => {
  const stay = getStay(stayId);
  const beforeState = { ...stay };

  const allowedUpdates = ['guest_count'];
  const updateData = {};

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('没有可更新的有效字段', null);
  }

  if (updateData.guest_count !== undefined) {
    if (updateData.guest_count <= 0 || !Number.isInteger(updateData.guest_count)) {
      throw new ValidationError('入住人数必须是正整数', 'guest_count');
    }

    const oldBasicWater = stay.basic_water_allocated;
    const newBasicWater = calculateBasicWater(updateData.guest_count);
    const waterDiff = newBasicWater - oldBasicWater;

    if (waterDiff > 0) {
      const tankStatus = waterTankService.getTankStatus();
      if (tankStatus.current_level < waterDiff) {
        throw new WaterQuotaExceededError(
          '水箱水量不足，无法增加配额',
          {
            tank_current: tankStatus.current_level,
            required_additional: waterDiff,
            deficit: waterDiff - tankStatus.current_level
          }
        );
      }

      const usageId = uuidv4();
      const usage = {
        id: usageId,
        stay_id: stayId,
        room_number: stay.room_number,
        usage_type: config.USAGE_TYPES.OTHER,
        amount: waterDiff,
        description: `人数调整增加配额 - 从${stay.guest_count}人增至${updateData.guest_count}人`,
        status: config.USAGE_STATUS.VALID,
        is_manual_correction: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

      waterTankService.consumeWater(waterDiff, usageId);

      recordHistory(
        'water_usage',
        usageId,
        config.OPERATION_TYPES.CREATE,
        null,
        usage,
        `入住人数调整: ${stay.guest_count} → ${updateData.guest_count}`,
        operator
      );

      updateData.basic_water_allocated = newBasicWater;
    } else if (waterDiff < 0) {
      const restoreAmount = Math.abs(waterDiff);
      const usageId = uuidv4();
      const usage = {
        id: usageId,
        stay_id: stayId,
        room_number: stay.room_number,
        usage_type: config.USAGE_TYPES.OTHER,
        amount: restoreAmount,
        description: `人数调整退还配额 - 从${stay.guest_count}人减至${updateData.guest_count}人`,
        status: config.USAGE_STATUS.VALID,
        is_manual_correction: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

      waterTankService.restoreWater(restoreAmount, '人数调整退还配额', usageId);

      recordHistory(
        'water_usage',
        usageId,
        config.OPERATION_TYPES.CREATE,
        null,
        usage,
        `入住人数调整: ${stay.guest_count} → ${updateData.guest_count}`,
        operator
      );

      updateData.basic_water_allocated = newBasicWater;
    }
  }

  updateData.updated_at = new Date().toISOString();

  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updateData), stayId];

  db.prepare(`UPDATE room_stays SET ${setClause} WHERE id = ?`).run(...values);

  const updatedStay = getStay(stayId);

  recordHistory(
    'room_stay',
    stayId,
    config.OPERATION_TYPES.UPDATE,
    beforeState,
    updatedStay,
    `更新入住信息: ${Object.keys(updateData).join(', ')}`,
    operator
  );

  return {
    success: true,
    stay: getStayWithUsage(stayId)
  };
};

const cancelCheckIn = (stayId, reason = null, operator = 'system') => {
  const stay = getStay(stayId);

  if (stay.status !== config.STAY_STATUS.ACTIVE) {
    throw new InvalidStateTransitionError(
      '只能取消活跃状态的入住记录',
      stay.status,
      config.STAY_STATUS.CANCELLED
    );
  }

  const usages = db.prepare(`
    SELECT * FROM water_usages 
    WHERE stay_id = ? AND status = ?
  `).all(stayId, config.USAGE_STATUS.VALID);

  let totalRefund = 0;
  for (const usage of usages) {
    const beforeState = { ...usage };
    db.prepare(`
      UPDATE water_usages 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(config.USAGE_STATUS.REVOKED, new Date().toISOString(), usage.id);

    const afterState = { ...usage, status: config.USAGE_STATUS.REVOKED, updated_at: new Date().toISOString() };
    totalRefund += usage.amount;

    recordHistory(
      'water_usage',
      usage.id,
      config.OPERATION_TYPES.REVOKE,
      beforeState,
      afterState,
      reason || '取消入住，撤销用水记录',
      operator
    );
  }

  if (totalRefund > 0) {
    waterTankService.restoreWater(totalRefund, '取消入住退还全部配额', 'cancel-' + stayId);
  }

  const beforeStay = { ...stay };
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE room_stays 
    SET status = ?, check_out_time = ?, updated_at = ?
    WHERE id = ?
  `).run(config.STAY_STATUS.CANCELLED, now, now, stayId);

  const afterStay = { 
    ...stay, 
    status: config.STAY_STATUS.CANCELLED, 
    check_out_time: now, 
    updated_at: now 
  };

  recordHistory(
    'room_stay',
    stayId,
    config.OPERATION_TYPES.REVOKE,
    beforeStay,
    afterStay,
    reason || '取消入住',
    operator
  );

  return {
    success: true,
    stay_id: stayId,
    refunded_water: totalRefund,
    cancelled_at: now
  };
};

module.exports = {
  getStay,
  getStayWithUsage,
  getAllActiveStays,
  checkIn,
  checkOut,
  updateStay,
  cancelCheckIn,
  checkRoomAvailability,
  calculateBasicWater
};
