const { getAsync, allAsync, runAsync } = require('../db');
const { CONFLICT_TYPES, CHANGE_STATUSES } = require('../constants/statuses');

class BusinessRuleError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'BusinessRuleError';
  }
}

async function checkInventoryConflict(newFoodBrand, newFoodType, requiredAmount = 1) {
  const inventory = await getAsync(`
    SELECT * FROM food_inventory 
    WHERE brand = ? AND type = ?
  `, [newFoodBrand, newFoodType]);

  if (!inventory) {
    return {
      hasConflict: true,
      type: CONFLICT_TYPES.INVENTORY_SHORTAGE,
      detail: `库存中不存在 [${newFoodBrand} - ${newFoodType}] 该款粮食`
    };
  }

  if (inventory.stock_quantity < requiredAmount) {
    return {
      hasConflict: true,
      type: CONFLICT_TYPES.INVENTORY_SHORTAGE,
      detail: `库存不足: 需要 ${requiredAmount}${inventory.unit}，当前仅存 ${inventory.stock_quantity}${inventory.unit}`
    };
  }

  if (inventory.stock_quantity <= inventory.warning_threshold) {
    return {
      hasConflict: false,
      warning: true,
      type: CONFLICT_TYPES.INVENTORY_SHORTAGE,
      detail: `库存预警: 当前库存 ${inventory.stock_quantity}${inventory.unit} 已低于预警线 ${inventory.warning_threshold}${inventory.unit}`
    };
  }

  return { hasConflict: false };
}

async function checkDailyReportConsistency(fosterOrderId, reportDate, expectedFoodBrand, expectedFoodType) {
  const report = await getAsync(`
    SELECT * FROM daily_care_reports 
    WHERE foster_order_id = ? AND report_date = ?
  `, [fosterOrderId, reportDate]);

  if (!report) {
    return {
      hasConflict: true,
      type: CONFLICT_TYPES.DAILY_REPORT_INCONSISTENCY,
      detail: `${reportDate} 的护理日报不存在，无法验证喂食变更一致性`
    };
  }

  const isConsistent = report.food_brand === expectedFoodBrand && report.food_type === expectedFoodType;
  
  if (!isConsistent) {
    return {
      hasConflict: true,
      type: CONFLICT_TYPES.DAILY_REPORT_INCONSISTENCY,
      detail: `护理日报不一致: 日报记录为 [${report.food_brand} - ${report.food_type}]，预期为 [${expectedFoodBrand} - ${expectedFoodType}]`,
      reportData: report
    };
  }

  return { hasConflict: false };
}

async function checkDuplicateChangeRequest(fosterOrderId, changeType, withinHours = 24) {
  const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  const existingChanges = await allAsync(`
    SELECT * FROM feeding_changes 
    WHERE foster_order_id = ? 
      AND change_type = ? 
      AND status NOT IN ('completed', 'cancelled', 'rejected')
      AND created_at > ?
  `, [fosterOrderId, changeType, cutoffTime]);

  if (existingChanges.length > 0) {
    return {
      hasConflict: true,
      type: CONFLICT_TYPES.DUPLICATE_CHANGE_REQUEST,
      detail: `${withinHours}小时内已存在同类变更请求，请勿重复提交`,
      existingChanges
    };
  }

  return { hasConflict: false };
}

async function detectAllConflicts(changeData) {
  const conflicts = [];
  const warnings = [];

  if (changeData.new_food_brand && changeData.new_food_type) {
    const inventoryResult = await checkInventoryConflict(
      changeData.new_food_brand,
      changeData.new_food_type,
      changeData.new_daily_amount || 1
    );
    if (inventoryResult.hasConflict) {
      conflicts.push(inventoryResult);
    } else if (inventoryResult.warning) {
      warnings.push(inventoryResult);
    }
  }

  const duplicateResult = await checkDuplicateChangeRequest(
    changeData.foster_order_id,
    changeData.change_type
  );
  if (duplicateResult.hasConflict) {
    conflicts.push(duplicateResult);
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    warnings,
    isAbnormal: conflicts.length > 0
  };
}

async function classifyRecord(changeData) {
  const detection = await detectAllConflicts(changeData);
  
  return {
    ...detection,
    recordType: detection.hasConflict ? 'abnormal' : 'normal'
  };
}

async function updateChangeConflicts(changeId, conflictDetection) {
  const conflictType = conflictDetection.conflicts.map(c => c.type).join(';');
  const conflictDetail = JSON.stringify(conflictDetection.conflicts);

  await runAsync(`
    UPDATE feeding_changes 
    SET conflict_detected = ?, conflict_type = ?, conflict_detail = ?,
        is_abnormal = ?, abnormal_reason = ?, updated_at = ?
    WHERE id = ?
  `, [
    conflictDetection.hasConflict ? 1 : 0,
    conflictType,
    conflictDetail,
    conflictDetection.isAbnormal ? 1 : 0,
    conflictDetection.conflicts.map(c => c.detail).join('; '),
    new Date().toISOString(),
    changeId
  ]);
}

module.exports = {
  BusinessRuleError,
  checkInventoryConflict,
  checkDailyReportConsistency,
  checkDuplicateChangeRequest,
  detectAllConflicts,
  classifyRecord,
  updateChangeConflicts
};
