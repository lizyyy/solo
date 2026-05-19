const moment = require('moment');

class ValidationResult {
  constructor(passed, reason, data = null) {
    this.passed = passed;
    this.reason = reason;
    this.data = data;
  }
}

function validateDosage(medicine, dosage, petWeight) {
  const totalDosage = dosage * petWeight;
  
  if (dosage < medicine.dosageMin) {
    return new ValidationResult(
      false,
      `剂量不足: ${dosage}${medicine.dosageUnit || 'mg/kg'} 低于最小剂量 ${medicine.dosageMin}${medicine.dosageUnit || 'mg/kg'}`,
      { totalDosage, dosage, min: medicine.dosageMin, max: medicine.dosageMax }
    );
  }
  
  if (dosage > medicine.dosageMax) {
    return new ValidationResult(
      false,
      `剂量超标: ${dosage}${medicine.dosageUnit || 'mg/kg'} 超出最大剂量 ${medicine.dosageMax}${medicine.dosageUnit || 'mg/kg'}`,
      { totalDosage, dosage, min: medicine.dosageMin, max: medicine.dosageMax }
    );
  }
  
  return new ValidationResult(
    true,
    `剂量正常: ${dosage}${medicine.dosageUnit || 'mg/kg'} 在安全范围 [${medicine.dosageMin}, ${medicine.dosageMax}] 内，总剂量 ${totalDosage.toFixed(4)}${medicine.dosageUnit || 'mg/kg'}`,
    { totalDosage, dosage, min: medicine.dosageMin, max: medicine.dosageMax }
  );
}

function checkContraindications(medicines) {
  const conflicts = [];
  
  for (let i = 0; i < medicines.length; i++) {
    const medA = medicines[i];
    let contraA = medA.contraindications || [];
    if (typeof contraA === 'string') {
      try { contraA = JSON.parse(contraA); } catch { contraA = []; }
    }
    
    for (let j = i + 1; j < medicines.length; j++) {
      const medB = medicines[j];
      let contraB = medB.contraindications || [];
      if (typeof contraB === 'string') {
        try { contraB = JSON.parse(contraB); } catch { contraB = []; }
      }
      
      if (contraA.includes(medB.name) || contraB.includes(medA.name)) {
        conflicts.push({
          medicineA: medA.name,
          medicineB: medB.name,
          reason: `${medA.name} 与 ${medB.name} 存在禁忌组合`
        });
      }
    }
  }
  
  if (conflicts.length > 0) {
    return new ValidationResult(
      false,
      `发现 ${conflicts.length} 组禁忌药品: ${conflicts.map(c => c.reason).join('; ')}`,
      { conflicts }
    );
  }
  
  return new ValidationResult(true, '药品组合无禁忌');
}

function checkBatchExpiry(inventoryItem) {
  const today = moment();
  const expiryDate = moment(inventoryItem.expiryDate);
  
  if (expiryDate.isBefore(today)) {
    return new ValidationResult(
      false,
      `批号 ${inventoryItem.batchNumber} 已过期，过期日期: ${inventoryItem.expiryDate}`,
      { expired: true, expiryDate: inventoryItem.expiryDate, daysExpired: today.diff(expiryDate, 'days') }
    );
  }
  
  const daysUntilExpiry = expiryDate.diff(today, 'days');
  
  if (daysUntilExpiry <= 30) {
    return new ValidationResult(
      true,
      `批号 ${inventoryItem.batchNumber} 将在 ${daysUntilExpiry} 天后过期，请注意`,
      { expired: false, daysUntilExpiry }
    );
  }
  
  return new ValidationResult(
    true,
    `批号 ${inventoryItem.batchNumber} 有效期正常`,
    { expired: false, daysUntilExpiry }
  );
}

function checkInventoryQuantity(inventoryItem, requiredQuantity) {
  if (inventoryItem.quantity < requiredQuantity) {
    return new ValidationResult(
      false,
      `库存不足: 需要 ${requiredQuantity}${inventoryItem.unit}，当前库存 ${inventoryItem.quantity}${inventoryItem.unit}`,
      { required: requiredQuantity, available: inventoryItem.quantity }
    );
  }
  
  return new ValidationResult(
    true,
    `库存充足: ${inventoryItem.quantity}${inventoryItem.unit} >= ${requiredQuantity}${inventoryItem.unit}`,
    { required: requiredQuantity, available: inventoryItem.quantity }
  );
}

async function validatePrescriptionItem(item, medicine, inventory, petWeight) {
  const results = [];
  
  const dosageResult = validateDosage(medicine, item.dosage, petWeight);
  results.push({ type: 'dosage', ...dosageResult });
  
  const expiryResult = checkBatchExpiry(inventory);
  results.push({ type: 'expiry', ...expiryResult });
  
  const quantityResult = checkInventoryQuantity(inventory, item.quantity);
  results.push({ type: 'quantity', ...quantityResult });
  
  const allPassed = results.every(r => r.passed);
  const reasons = results.map(r => r.reason).join('; ');
  
  return {
    passed: allPassed,
    reasons,
    details: results,
    totalDosage: dosageResult.data.totalDosage
  };
}

function processBatch(items, processor) {
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < items.length; i++) {
    try {
      const result = processor(items[i], i);
      results.push({
        index: i,
        success: result.success,
        id: result.id || null,
        reason: result.reason,
        data: result.data || null
      });
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: error.message,
        reason: `处理异常: ${error.message}`
      });
      failCount++;
    }
  }
  
  return {
    allSuccess: failCount === 0,
    successCount,
    failCount,
    results
  };
}

module.exports = {
  ValidationResult,
  validateDosage,
  checkContraindications,
  checkBatchExpiry,
  checkInventoryQuantity,
  validatePrescriptionItem,
  processBatch
};
