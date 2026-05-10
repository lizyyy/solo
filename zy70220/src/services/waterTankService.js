const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const { recordHistory } = require('../utils/history');
const { 
  ValidationError, 
  ResourceNotFoundError, 
  ConflictError 
} = require('../utils/errors');

const getTank = (tankId = config.DEFAULT_WATER_TANK_ID) => {
  const tank = db.prepare('SELECT * FROM water_tanks WHERE id = ?').get(tankId);
  if (!tank) {
    throw new ResourceNotFoundError('水箱不存在');
  }
  return tank;
};

const getTankStatus = (tankId = config.DEFAULT_WATER_TANK_ID) => {
  const tank = getTank(tankId);
  const usage = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_usage
    FROM water_usages
    WHERE status = ?
  `).get('valid');

  const percentage = (tank.current_level / tank.max_capacity) * 100;
  
  return {
    ...tank,
    total_usage: usage.total_usage,
    percentage_remaining: percentage,
    is_low: percentage < 20
  };
};

const supplyWater = (amount, reason = null, operator = 'system', tankId = config.DEFAULT_WATER_TANK_ID) => {
  if (amount <= 0) {
    throw new ValidationError('补给水量必须大于0', 'amount');
  }

  const tank = getTank(tankId);
  const beforeState = { ...tank };
  
  const newLevel = Math.min(tank.current_level + amount, tank.max_capacity);
  const actualSupply = newLevel - tank.current_level;

  if (actualSupply === 0) {
    throw new ConflictError('水箱已满，无法继续补给');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE water_tanks 
    SET current_level = ?, updated_at = ?
    WHERE id = ?
  `).run(newLevel, now, tankId);

  const afterState = { ...tank, current_level: newLevel, updated_at: now };

  recordHistory(
    'water_tank',
    tankId,
    config.OPERATION_TYPES.SUPPLY,
    beforeState,
    afterState,
    reason || `补给水量 ${actualSupply}L`,
    operator
  );

  return {
    success: true,
    tank_id: tankId,
    requested_amount: amount,
    actual_supply: actualSupply,
    previous_level: tank.current_level,
    new_level: newLevel
  };
};

const consumeWater = (amount, usageId, tankId = config.DEFAULT_WATER_TANK_ID) => {
  if (amount <= 0) {
    throw new ValidationError('用水量必须大于0', 'amount');
  }

  const tank = getTank(tankId);
  
  if (tank.current_level < amount) {
    return {
      success: false,
      reason: 'insufficient_water',
      current_level: tank.current_level,
      requested_amount: amount
    };
  }

  const beforeState = { ...tank };
  const newLevel = tank.current_level - amount;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE water_tanks 
    SET current_level = ?, updated_at = ?
    WHERE id = ?
  `).run(newLevel, now, tankId);

  const afterState = { ...tank, current_level: newLevel, updated_at: now };

  recordHistory(
    'water_tank',
    tankId,
    'consume',
    beforeState,
    afterState,
    `用水 ${amount}L，关联记录: ${usageId}`,
    'system'
  );

  return {
    success: true,
    previous_level: tank.current_level,
    new_level: newLevel,
    consumed: amount
  };
};

const restoreWater = (amount, reason, usageId, tankId = config.DEFAULT_WATER_TANK_ID) => {
  if (amount <= 0) {
    throw new ValidationError('归还水量必须大于0', 'amount');
  }

  const tank = getTank(tankId);
  const beforeState = { ...tank };
  
  const newLevel = Math.min(tank.current_level + amount, tank.max_capacity);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE water_tanks 
    SET current_level = ?, updated_at = ?
    WHERE id = ?
  `).run(newLevel, now, tankId);

  const afterState = { ...tank, current_level: newLevel, updated_at: now };

  recordHistory(
    'water_tank',
    tankId,
    'restore',
    beforeState,
    afterState,
    `${reason}，关联记录: ${usageId}`,
    'system'
  );

  return {
    success: true,
    previous_level: tank.current_level,
    new_level: newLevel,
    restored: amount
  };
};

module.exports = {
  getTank,
  getTankStatus,
  supplyWater,
  consumeWater,
  restoreWater
};
