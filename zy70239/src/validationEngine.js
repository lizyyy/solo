const config = require('./config');
const storage = require('./storage');
const assignmentEngine = require('./assignmentEngine');

const ILLEGAL_FLOWS = [
  { from: 'IMPORT', to: 'INTERNAL_TRANSFER', reason: '进口危险品未经清关不得进行内部转场' },
  { from: 'EXPORT', to: 'IMPORT', reason: '出口危险品不得转为进口流程' },
  { from: 'INTERNAL_TRANSFER', to: 'EXPORT', reason: '内部转场危险品不得直接出口' },
  { from: 'PENDING_REVIEW', to: 'COMPLETED', reason: '待审核状态不得直接标记为完成' }
];

const REQUIRED_FIELDS = [
  'batchId',
  'goodsNo',
  'category',
  'weight',
  'operationType',
  'containerNo',
  'unCode'
];

const RISK_LEVELS = {
  CRITICAL: { id: 1, name: '极高风险', color: 'red' },
  HIGH: { id: 2, name: '高风险', color: 'orange' },
  MEDIUM: { id: 3, name: '中风险', color: 'yellow' },
  LOW: { id: 4, name: '低风险', color: 'green' }
};

function validateRequiredFields(data) {
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  return {
    valid: missing.length === 0,
    missing
  };
}

function validateCategory(category) {
  const validCategories = Object.keys(config.ISOLATION_RULES.categories);
  return {
    valid: validCategories.includes(category),
    validCategories
  };
}

function validateOperationType(operationType) {
  const validTypes = ['IMPORT', 'EXPORT', 'INTERNAL_TRANSFER'];
  return {
    valid: validTypes.includes(operationType),
    validTypes
  };
}

function validateWeight(weight) {
  const num = parseFloat(weight);
  if (isNaN(num)) {
    return { valid: false, error: '重量必须是数字' };
  }
  if (num <= 0) {
    return { valid: false, error: '重量必须大于0' };
  }
  if (num > 50000) {
    return { valid: false, error: '单件重量不得超过50吨' };
  }
  return { valid: true };
}

function validateUnCode(unCode) {
  const pattern = /^UN\d{4}$/;
  return {
    valid: pattern.test(unCode),
    pattern: 'UNXXXX（4位数字）'
  };
}

function checkIllegalFlow(currentStatus, targetStatus) {
  for (const flow of ILLEGAL_FLOWS) {
    if (flow.from === currentStatus && flow.to === targetStatus) {
      return {
        isIllegal: true,
        reason: flow.reason
      };
    }
  }
  return { isIllegal: false };
}

function calculateRiskLevel(category, violations) {
  const baseRiskMap = {
    EXPLOSIVES: 'CRITICAL',
    RADIOACTIVE: 'CRITICAL',
    TOXIC: 'HIGH',
    GASES: 'HIGH',
    OXIDIZING: 'MEDIUM',
    FLAMMABLE_LIQUIDS: 'MEDIUM',
    FLAMMABLE_SOLIDS: 'LOW',
    CORROSIVE: 'MEDIUM',
    MISCELLANEOUS: 'LOW'
  };
  
  let riskLevel = baseRiskMap[category] || 'LOW';
  
  if (violations && violations.length > 0) {
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    const highViolations = violations.filter(v => v.severity === 'HIGH');
    
    if (criticalViolations.length > 0) {
      riskLevel = 'CRITICAL';
    } else if (highViolations.length > 0 && riskLevel !== 'CRITICAL') {
      riskLevel = 'HIGH';
    }
  }
  
  return {
    level: riskLevel,
    info: RISK_LEVELS[riskLevel]
  };
}

async function validateGoodsData(goodsData) {
  const results = [];
  const errors = [];
  
  const fieldValidation = validateRequiredFields(goodsData);
  if (!fieldValidation.valid) {
    errors.push({
      type: 'MISSING_FIELDS',
      severity: 'HIGH',
      message: `缺少必填字段: ${fieldValidation.missing.join(', ')}`,
      fields: fieldValidation.missing
    });
  }
  
  if (goodsData.category) {
    const categoryValidation = validateCategory(goodsData.category);
    if (!categoryValidation.valid) {
      errors.push({
        type: 'INVALID_CATEGORY',
        severity: 'CRITICAL',
        message: `无效的危险品类别: ${goodsData.category}`,
        validCategories: categoryValidation.validCategories
      });
    }
  }
  
  if (goodsData.operationType) {
    const opValidation = validateOperationType(goodsData.operationType);
    if (!opValidation.valid) {
      errors.push({
        type: 'INVALID_OPERATION',
        severity: 'HIGH',
        message: `无效的作业类型: ${goodsData.operationType}`,
        validTypes: opValidation.validTypes
      });
    }
  }
  
  if (goodsData.weight !== undefined) {
    const weightValidation = validateWeight(goodsData.weight);
    if (!weightValidation.valid) {
      errors.push({
        type: 'INVALID_WEIGHT',
        severity: 'MEDIUM',
        message: weightValidation.error
      });
    }
  }
  
  if (goodsData.unCode) {
    const unCodeValidation = validateUnCode(goodsData.unCode);
    if (!unCodeValidation.valid) {
      errors.push({
        type: 'INVALID_UNCODE',
        severity: 'MEDIUM',
        message: `UN编号格式错误，应为: ${unCodeValidation.pattern}`
      });
    }
  }
  
  const risk = calculateRiskLevel(goodsData.category, errors);
  
  return {
    success: errors.length === 0,
    errors,
    riskLevel: risk.level,
    riskInfo: risk.info
  };
}

async function validateAssignment(goods, assignment, batchGoods) {
  const violations = [];
  
  const zoneKey = assignment.zone;
  const zone = assignmentEngine.YARD_AREAS[zoneKey];
  
  if (!zone.allowedCategories.includes(goods.category)) {
    violations.push({
      type: 'ZONE_MISMATCH',
      severity: 'CRITICAL',
      message: `危险品类别 ${goods.category} 不允许堆放在 ${zone.name}`
    });
  }
  
  const requiredDistance = config.ISOLATION_RULES.distances[goods.category] || 10;
  const existingInZone = batchGoods.filter(g => 
    g.id !== goods.id && 
    g.zone === zoneKey && 
    g.slot !== undefined
  );
  
  for (const existing of existingInZone) {
    const existingPos = {
      x: existing.position?.x || 0,
      y: existing.position?.y || 0
    };
    const newPos = {
      x: assignment.position?.x || 0,
      y: assignment.position?.y || 0
    };
    
    const distance = Math.sqrt(
      Math.pow(newPos.x - existingPos.x, 2) + 
      Math.pow(newPos.y - existingPos.y, 2)
    );
    
    if (distance < requiredDistance) {
      violations.push({
        type: 'INSUFFICIENT_DISTANCE',
        severity: 'HIGH',
        message: `与 ${existing.goodsNo} 隔离距离不足: ${distance.toFixed(1)}m < ${requiredDistance}m`,
        details: {
          goodsNo: existing.goodsNo,
          actualDistance: distance,
          requiredDistance
        }
      });
    }
    
    if (assignmentEngine.checkIncompatibleCategories(goods.category, existing.category)) {
      violations.push({
        type: 'INCOMPATIBLE_CATEGORIES',
        severity: 'CRITICAL',
        message: `与 ${existing.goodsNo} (${config.ISOLATION_RULES.categories[existing.category]?.name}) 属于不相容类别`,
        details: {
          goodsNo: existing.goodsNo,
          category: existing.category,
          categoryName: config.ISOLATION_RULES.categories[existing.category]?.name
        }
      });
    }
  }
  
  const risk = calculateRiskLevel(goods.category, violations);
  
  return {
    valid: violations.length === 0,
    violations,
    riskLevel: risk.level,
    riskInfo: risk.info,
    zone,
    requiredDistance
  };
}

async function checkDuplicateSubmission(goodsData, batchId) {
  const existingGoods = await storage.getGoodsByBatch(batchId);
  const duplicate = existingGoods.find(g => g.goodsNo === goodsData.goodsNo);
  
  if (duplicate) {
    return {
      isDuplicate: true,
      existing: duplicate,
      message: `危险品 ${goodsData.goodsNo} 已在批次 ${batchId} 中存在`
    };
  }
  
  return { isDuplicate: false };
}

module.exports = {
  validateRequiredFields,
  validateCategory,
  validateOperationType,
  validateWeight,
  validateUnCode,
  checkIllegalFlow,
  calculateRiskLevel,
  validateGoodsData,
  validateAssignment,
  checkDuplicateSubmission,
  RISK_LEVELS,
  REQUIRED_FIELDS
};
