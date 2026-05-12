const VALID_TYPES = ['book', 'scan', 'freeze', 'manual', 'recheck'];

function validateBookData(data) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    return [{ field: 'root', message: '账面数据必须是数组' }];
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.sku) {
      errors.push({ field: `[${i}].sku`, message: '缺少商品编码 (sku)' });
    }
    if (!item.location) {
      errors.push({ field: `[${i}].location`, message: '缺少库位 (location)' });
    }
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      errors.push({ field: `[${i}].quantity`, message: '数量必须是非负数字' });
    }
  }
  
  return errors;
}

function validateScanData(data) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    return [{ field: 'root', message: '扫码数据必须是数组' }];
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.sku) {
      errors.push({ field: `[${i}].sku`, message: '缺少商品编码 (sku)' });
    }
    if (!item.location) {
      errors.push({ field: `[${i}].location`, message: '缺少库位 (location)' });
    }
    if (!item.scanTime) {
      errors.push({ field: `[${i}].scanTime`, message: '缺少扫码时间 (scanTime)' });
    }
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      errors.push({ field: `[${i}].quantity`, message: '数量必须是非负数字' });
    }
  }
  
  return errors;
}

function validateFreezeData(data) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    return [{ field: 'root', message: '冻结数据必须是数组' }];
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.location) {
      errors.push({ field: `[${i}].location`, message: '缺少库位 (location)' });
    }
    if (!item.freezeTime) {
      errors.push({ field: `[${i}].freezeTime`, message: '缺少冻结时间 (freezeTime)' });
    }
    if (!item.operator) {
      errors.push({ field: `[${i}].operator`, message: '缺少操作员 (operator)' });
    }
  }
  
  return errors;
}

function validateManualData(data) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    return [{ field: 'root', message: '手工补录数据必须是数组' }];
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.sku) {
      errors.push({ field: `[${i}].sku`, message: '缺少商品编码 (sku)' });
    }
    if (!item.location) {
      errors.push({ field: `[${i}].location`, message: '缺少库位 (location)' });
    }
    if (typeof item.quantity !== 'number') {
      errors.push({ field: `[${i}].quantity`, message: '缺少数量 (quantity)' });
    }
    if (!item.reason) {
      errors.push({ field: `[${i}].reason`, message: '缺少补录原因 (reason)' });
    }
    if (!item.operator) {
      errors.push({ field: `[${i}].operator`, message: '缺少操作员 (operator)' });
    }
  }
  
  return errors;
}

function validateRecheckData(data) {
  const errors = [];
  
  if (!Array.isArray(data)) {
    return [{ field: 'root', message: '复盘数据必须是数组' }];
  }
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.sku) {
      errors.push({ field: `[${i}].sku`, message: '缺少商品编码 (sku)' });
    }
    if (!item.location) {
      errors.push({ field: `[${i}].location`, message: '缺少库位 (location)' });
    }
    if (typeof item.quantity !== 'number' || item.quantity < 0) {
      errors.push({ field: `[${i}].quantity`, message: '数量必须是非负数字' });
    }
    if (!item.recheckTime) {
      errors.push({ field: `[${i}].recheckTime`, message: '缺少复盘时间 (recheckTime)' });
    }
    if (!item.operator) {
      errors.push({ field: `[${i}].operator`, message: '缺少操作员 (operator)' });
    }
  }
  
  return errors;
}

const validators = {
  book: validateBookData,
  scan: validateScanData,
  freeze: validateFreezeData,
  manual: validateManualData,
  recheck: validateRecheckData
};

function validate(type, data) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`不支持的数据类型: ${type}. 支持的类型: ${VALID_TYPES.join(', ')}`);
  }
  
  return validators[type](data);
}

function isValidType(type) {
  return VALID_TYPES.includes(type);
}

module.exports = {
  VALID_TYPES,
  validate,
  isValidType
};
