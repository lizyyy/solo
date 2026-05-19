import { getRecords, getInventory } from './storage.js';

export const RULES = {
  TEMPERATURE_CHECK: 'temperature_check',
  BATCH_DUPLICATE: 'batch_duplicate',
  MISSING_PHOTO: 'missing_photo',
  INVENTORY_CHANGE: 'inventory_change'
};

export function checkTemperature(record) {
  const { productType, temperature } = record;
  
  if (!temperature && temperature !== 0) {
    return { passed: false, rule: RULES.TEMPERATURE_CHECK, reason: '缺少温度记录' };
  }
  
  let minTemp, maxTemp, productName;
  
  if (productType === 'vaccine') {
    minTemp = 2;
    maxTemp = 8;
    productName = '疫苗';
  } else if (productType === 'insulin') {
    minTemp = 2;
    maxTemp = 8;
    productName = '胰岛素';
  } else {
    return { passed: true, rule: RULES.TEMPERATURE_CHECK, reason: '产品类型无需温度检查' };
  }
  
  if (temperature < minTemp || temperature > maxTemp) {
    return { 
      passed: false, 
      rule: RULES.TEMPERATURE_CHECK, 
      reason: `${productName}温度${temperature}℃超出安全范围(${minTemp}-${maxTemp}℃)` 
    };
  }
  
  return { passed: true, rule: RULES.TEMPERATURE_CHECK, reason: '温度符合要求' };
}

export async function checkBatchDuplicate(record) {
  const { batchNumber, productName } = record;
  
  if (!batchNumber) {
    return { passed: false, rule: RULES.BATCH_DUPLICATE, reason: '缺少批号' };
  }
  
  const records = await getRecords();
  const duplicate = records.find(r => 
    r.batchNumber === batchNumber && 
    r.id !== record.id && 
    r.status === 'approved'
  );
  
  if (duplicate) {
    return { 
      passed: false, 
      rule: RULES.BATCH_DUPLICATE, 
      reason: `批号${batchNumber}(${productName})已存在入库记录` 
    };
  }
  
  return { passed: true, rule: RULES.BATCH_DUPLICATE, reason: '批号无重复' };
}

export function checkMissingPhoto(record) {
  const { photoProof } = record;
  
  if (!photoProof) {
    return { passed: false, rule: RULES.MISSING_PHOTO, reason: '缺少到货照片凭证' };
  }
  
  return { passed: true, rule: RULES.MISSING_PHOTO, reason: '已提供照片凭证' };
}

export async function checkInventoryChange(record) {
  const { batchNumber, quantity, productName } = record;
  
  if (record.status !== 'approved') {
    return { passed: true, rule: RULES.INVENTORY_CHANGE, reason: '待复核记录不影响库存' };
  }
  
  const inventory = await getInventory();
  const existingInventory = inventory[batchNumber];
  
  if (existingInventory) {
    return { 
      passed: true, 
      rule: RULES.INVENTORY_CHANGE, 
      reason: `批号${batchNumber}库存将从${existingInventory.quantity}增加${quantity}至${existingInventory.quantity + quantity}` 
    };
  }
  
  return { 
    passed: true, 
    rule: RULES.INVENTORY_CHANGE, 
    reason: `批号${batchNumber}(${productName})将新增库存${quantity}` 
  };
}

export async function validateRecord(record, isReview = false) {
  const results = [];
  
  results.push(checkTemperature(record));
  results.push(await checkBatchDuplicate(record));
  results.push(checkMissingPhoto(record));
  
  if (isReview) {
    results.push(await checkInventoryChange(record));
  }
  
  const failedRules = results.filter(r => !r.passed);
  const passed = failedRules.length === 0;
  const reasons = results.map(r => r.reason).join('; ');
  
  return {
    passed,
    failedRules: failedRules.map(r => r.rule),
    reasons,
    details: results
  };
}

export async function reviewRecord(record, approve) {
  const validation = await validateRecord(record, true);
  
  if (approve && !validation.passed) {
    return {
      success: false,
      status: 'rejected',
      reason: `无法通过复核: ${validation.reasons}`
    };
  }
  
  if (!approve) {
    return {
      success: true,
      status: 'rejected',
      reason: '人工驳回'
    };
  }
  
  return {
    success: true,
    status: 'approved',
    reason: validation.reasons,
    inventoryUpdate: validation.details.find(r => r.rule === RULES.INVENTORY_CHANGE)
  };
}
