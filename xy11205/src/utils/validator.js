const VALID_ROLES = ['warehouse_manager', 'pharmacist', 'reviewer'];
const VALID_PRODUCT_TYPES = ['vaccine', 'insulin'];
const VALID_PHOTO_TYPES = ['package', 'damage', 'receipt'];

function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    return {
      valid: false,
      message: `无效角色: ${role}。有效角色: ${VALID_ROLES.join(', ')}`,
      suggestion: `请从以下角色中选择: ${VALID_ROLES.join(', ')}`
    };
  }
  return { valid: true };
}

function validateOperator(operator) {
  if (!operator || typeof operator !== 'string' || operator.trim().length < 2) {
    return {
      valid: false,
      message: '操作人姓名不能为空，且长度至少为2个字符',
      suggestion: '请填写有效的操作人姓名'
    };
  }
  return { valid: true };
}

function validateProductType(type) {
  if (!VALID_PRODUCT_TYPES.includes(type)) {
    return {
      valid: false,
      message: `无效产品类型: ${type}。有效类型: ${VALID_PRODUCT_TYPES.join(', ')}`,
      suggestion: `请从以下产品类型中选择: ${VALID_PRODUCT_TYPES.join(', ')}`
    };
  }
  return { valid: true };
}

function validateTemperature(temp) {
  const num = parseFloat(temp);
  if (isNaN(num)) {
    return {
      valid: false,
      message: `温度值无效: ${temp}`,
      suggestion: '请输入有效的数字温度值'
    };
  }
  if (num < -80 || num > 30) {
    return {
      valid: false,
      message: `温度超出合理范围: ${temp}°C`,
      suggestion: '请检查温度是否在正常范围内（-80°C 至 30°C）'
    };
  }
  return { valid: true };
}

function validateQuantity(quantity) {
  const num = parseInt(quantity);
  if (isNaN(num) || num <= 0) {
    return {
      valid: false,
      message: `数量无效: ${quantity}`,
      suggestion: '请输入大于0的整数数量'
    };
  }
  return { valid: true };
}

function validateDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      message: `日期格式无效: ${dateStr}`,
      suggestion: '请使用有效的日期格式（如: YYYY-MM-DD HH:mm:ss）'
    };
  }
  return { valid: true };
}

function validateBatchNumber(batch) {
  if (!batch || batch.trim().length < 3) {
    return {
      valid: false,
      message: `批号无效: ${batch}`,
      suggestion: '批号长度至少为3个字符'
    };
  }
  return { valid: true };
}

module.exports = {
  VALID_ROLES,
  VALID_PRODUCT_TYPES,
  VALID_PHOTO_TYPES,
  validateRole,
  validateOperator,
  validateProductType,
  validateTemperature,
  validateQuantity,
  validateDate,
  validateBatchNumber
};
