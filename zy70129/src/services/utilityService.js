const { getDatabase } = require('../database/init');
const { generateId } = require('../utils/idGenerator');
const { ORDER_STATUS, MODULES, UTILITY_TYPE, ADJUSTMENT_TYPE } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');
const { getOrderById } = require('./orderService');

function validateUtilityRecordData(data) {
  const errors = [];
  if (!data.order_id) errors.push('order_id不能为空');
  if (!data.utility_type || ![UTILITY_TYPE.WATER, UTILITY_TYPE.ELECTRICITY].includes(data.utility_type)) {
    errors.push('utility_type必须是WATER或ELECTRICITY');
  }
  if (data.initial_reading === undefined || data.initial_reading < 0) {
    errors.push('initial_reading不能为空且不能为负数');
  }
  if (data.unit_price === undefined || data.unit_price < 0) {
    errors.push('unit_price不能为空且不能为负数');
  }
  return errors;
}

function calculateUtilityUsage(initialReading, finalReading) {
  if (finalReading === null || finalReading === undefined) return null;
  if (finalReading < initialReading) {
    throw new Error('最终读数不能小于初始读数');
  }
  return parseFloat((finalReading - initialReading).toFixed(4));
}

function calculateUtilityAmount(usage, unitPrice) {
  if (usage === null || usage === undefined) return null;
  return parseFloat((usage * unitPrice).toFixed(2));
}

function createUtilityRecord(data, operator) {
  const db = getDatabase();
  const errors = validateUtilityRecordData(data);

  if (errors.length > 0) {
    throw new Error('水电记录数据校验失败: ' + errors.join(', '));
  }

  const order = getOrderById(data.order_id);
  if (!order) {
    throw new Error('订单不存在');
  }

  let usageAmount = null;
  let calculatedAmount = null;

  if (data.final_reading !== undefined && data.final_reading !== null) {
    usageAmount = calculateUtilityUsage(data.initial_reading, data.final_reading);
    calculatedAmount = calculateUtilityAmount(usageAmount, data.unit_price);
  }

  const recordId = generateId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO utility_records (
      id, order_id, utility_type, initial_reading, final_reading,
      unit_price, usage_amount, calculated_amount, record_by,
      record_at, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    recordId,
    data.order_id,
    data.utility_type,
    data.initial_reading,
    data.final_reading || null,
    data.unit_price,
    usageAmount,
    calculatedAmount,
    operator,
    now,
    data.remark || null
  );

  logAudit('CREATE', MODULES.UTILITY, operator, {
    targetId: recordId,
    targetType: 'utility_record',
    newValues: {
      ...data,
      usage_amount: usageAmount,
      calculated_amount: calculatedAmount
    }
  });

  return getUtilityRecordById(recordId);
}

function getUtilityRecordById(recordId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM utility_records WHERE id = ?
  `).get(recordId);
}

function getUtilityRecordsByOrderId(orderId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM utility_records 
    WHERE order_id = ? 
    ORDER BY created_at ASC
  `).all(orderId);
}

function updateUtilityRecord(recordId, data, operator) {
  const db = getDatabase();
  const record = getUtilityRecordById(recordId);

  if (!record) {
    throw new Error('水电记录不存在');
  }

  const order = getOrderById(record.order_id);
  if (order && order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('订单已完成，不允许修改水电记录');
  }

  const allowedUpdates = [
    'initial_reading', 'final_reading', 'unit_price', 'remark'
  ];

  const updateFields = [];
  const updateValues = [];
  const oldValues = {};
  const newValues = {};

  let newInitial = data.initial_reading !== undefined ? data.initial_reading : record.initial_reading;
  let newFinal = data.final_reading !== undefined ? data.final_reading : record.final_reading;
  let newPrice = data.unit_price !== undefined ? data.unit_price : record.unit_price;

  for (const key of allowedUpdates) {
    if (data[key] !== undefined) {
      updateFields.push(`${key} = ?`);
      updateValues.push(data[key]);
      oldValues[key] = record[key];
      newValues[key] = data[key];
    }
  }

  if (updateFields.length === 0) {
    return record;
  }

  let usageAmount = record.usage_amount;
  let calculatedAmount = record.calculated_amount;

  if (newFinal !== null && newFinal !== undefined) {
    usageAmount = calculateUtilityUsage(newInitial, newFinal);
    calculatedAmount = calculateUtilityAmount(usageAmount, newPrice);
    updateFields.push('usage_amount = ?', 'calculated_amount = ?');
    updateValues.push(usageAmount, calculatedAmount);
    newValues.usage_amount = usageAmount;
    newValues.calculated_amount = calculatedAmount;
  }

  updateValues.push(recordId);

  db.prepare(`
    UPDATE utility_records 
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `).run(...updateValues);

  logAudit('UPDATE', MODULES.UTILITY, operator, {
    targetId: recordId,
    targetType: 'utility_record',
    oldValues,
    newValues
  });

  return getUtilityRecordById(recordId);
}

function deleteUtilityRecord(recordId, operator) {
  const db = getDatabase();
  const record = getUtilityRecordById(recordId);

  if (!record) {
    throw new Error('水电记录不存在');
  }

  const order = getOrderById(record.order_id);
  if (order && order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('订单已完成，不允许删除水电记录');
  }

  const allocations = db.prepare(`
    SELECT id FROM utility_allocations WHERE utility_record_id = ?
  `).all(recordId);

  if (allocations.length > 0) {
    db.prepare(`DELETE FROM utility_allocations WHERE utility_record_id = ?`).run(recordId);
  }

  db.prepare(`DELETE FROM utility_records WHERE id = ?`).run(recordId);

  logAudit('DELETE', MODULES.UTILITY, operator, {
    targetId: recordId,
    targetType: 'utility_record',
    oldValues: record
  });

  return true;
}

function createUtilityAllocation(recordId, orderId, ratio, rule, operator) {
  const db = getDatabase();
  const record = getUtilityRecordById(recordId);

  if (!record) {
    throw new Error('水电记录不存在');
  }

  if (!record.calculated_amount) {
    throw new Error('水电费用尚未计算，无法分摊');
  }

  if (ratio <= 0 || ratio > 1) {
    throw new Error('分摊比例必须在(0, 1]之间');
  }

  const allocatedAmount = parseFloat((record.calculated_amount * ratio).toFixed(2));
  const allocationId = generateId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO utility_allocations (
      id, utility_record_id, order_id, allocation_ratio,
      allocated_amount, allocation_rule, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    allocationId,
    recordId,
    orderId,
    ratio,
    allocatedAmount,
    rule || null,
    operator,
    now
  );

  logAudit('ALLOCATE', MODULES.UTILITY, operator, {
    targetId: allocationId,
    targetType: 'utility_allocation',
    newValues: {
      utility_record_id: recordId,
      order_id: orderId,
      allocation_ratio: ratio,
      allocated_amount: allocatedAmount,
      allocation_rule: rule
    }
  });

  return db.prepare(`SELECT * FROM utility_allocations WHERE id = ?`).get(allocationId);
}

function getUtilityAllocationsByRecordId(recordId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM utility_allocations 
    WHERE utility_record_id = ? 
    ORDER BY created_at ASC
  `).all(recordId);
}

function getUtilityAllocationsByOrderId(orderId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT ua.*, ur.utility_type, ur.initial_reading, ur.final_reading, ur.unit_price
    FROM utility_allocations ua
    JOIN utility_records ur ON ua.utility_record_id = ur.id
    WHERE ua.order_id = ? 
    ORDER BY ua.created_at ASC
  `).all(orderId);
}

function getUtilityTotal(orderId) {
  const db = getDatabase();
  
  const directRecords = db.prepare(`
    SELECT COALESCE(SUM(calculated_amount), 0) as total
    FROM utility_records 
    WHERE order_id = ? AND calculated_amount IS NOT NULL
  `).get(orderId);

  const allocations = db.prepare(`
    SELECT COALESCE(SUM(allocated_amount), 0) as total
    FROM utility_allocations 
    WHERE order_id = ?
  `).get(orderId);

  return parseFloat((directRecords.total + allocations.total).toFixed(2));
}

function manuallyAdjustUtilityAllocation(allocationId, newAmount, reason, operator) {
  if (!reason) {
    throw new Error('人工调整必须提供原因');
  }

  const db = getDatabase();
  const allocation = db.prepare(`
    SELECT * FROM utility_allocations WHERE id = ?
  `).get(allocationId);

  if (!allocation) {
    throw new Error('水电分摊记录不存在');
  }

  const oldAmount = allocation.allocated_amount;
  const adjustmentAmount = newAmount - oldAmount;

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE utility_allocations 
      SET allocated_amount = ?
      WHERE id = ?
    `).run(newAmount, allocationId);

    const adjustmentId = generateId();
    db.prepare(`
      INSERT INTO manual_adjustments (
        id, order_id, adjustment_type, old_value, new_value,
        adjustment_amount, reason, adjusted_by, adjusted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adjustmentId,
      allocation.order_id,
      ADJUSTMENT_TYPE.UTILITY,
      oldAmount,
      newAmount,
      adjustmentAmount,
      reason,
      operator,
      new Date().toISOString()
    );
  });

  transaction();

  logAudit('MANUAL_ADJUST', MODULES.UTILITY, operator, {
    targetId: allocationId,
    targetType: 'utility_allocation',
    oldValues: { allocated_amount: oldAmount },
    newValues: { allocated_amount: newAmount },
    remark: reason
  });

  return db.prepare(`SELECT * FROM utility_allocations WHERE id = ?`).get(allocationId);
}

module.exports = {
  validateUtilityRecordData,
  calculateUtilityUsage,
  calculateUtilityAmount,
  createUtilityRecord,
  getUtilityRecordById,
  getUtilityRecordsByOrderId,
  updateUtilityRecord,
  deleteUtilityRecord,
  createUtilityAllocation,
  getUtilityAllocationsByRecordId,
  getUtilityAllocationsByOrderId,
  getUtilityTotal,
  manuallyAdjustUtilityAllocation
};
