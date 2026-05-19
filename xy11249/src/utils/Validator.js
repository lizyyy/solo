const BadRecord = require('../models/BadRecord');

class Validator {
  static validateRequired(value, fieldName, rawData, rowNumber, sourceFile, sourceType) {
    if (value === undefined || value === null || value === '') {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'MissingRequiredField',
        errorMessage: `缺少必填字段: ${fieldName}`,
        fieldName,
        fieldValue: value,
        suggestion: `请填写 ${fieldName} 字段的值`,
      });
    }
    return null;
  }

  static validateNumber(value, fieldName, rawData, rowNumber, sourceFile, sourceType) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'InvalidNumber',
        errorMessage: `字段 ${fieldName} 不是有效数字`,
        fieldName,
        fieldValue: value,
        suggestion: `请将 ${fieldName} 改为有效的数字，例如: 10 或 9.99`,
      });
    }
    return null;
  }

  static validateInteger(value, fieldName, rawData, rowNumber, sourceFile, sourceType) {
    const num = parseInt(value, 10);
    if (isNaN(num) || !Number.isInteger(parseFloat(value))) {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'InvalidInteger',
        errorMessage: `字段 ${fieldName} 不是有效整数`,
        fieldName,
        fieldValue: value,
        suggestion: `请将 ${fieldName} 改为有效的整数，例如: 1, 2, 3`,
      });
    }
    return null;
  }

  static validateDate(value, fieldName, rawData, rowNumber, sourceFile, sourceType) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'InvalidDate',
        errorMessage: `字段 ${fieldName} 不是有效日期格式`,
        fieldName,
        fieldValue: value,
        suggestion: `请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss 格式，例如: 2024-01-15`,
      });
    }
    return null;
  }

  static validatePhone(value, fieldName, rawData, rowNumber, sourceFile, sourceType) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'InvalidPhone',
        errorMessage: `字段 ${fieldName} 不是有效的手机号码`,
        fieldName,
        fieldValue: value,
        suggestion: `请输入11位有效的手机号码，例如: 13800138000`,
      });
    }
    return null;
  }

  static validateEnum(value, fieldName, allowedValues, rawData, rowNumber, sourceFile, sourceType) {
    if (!allowedValues.includes(value)) {
      return new BadRecord({
        sourceType,
        sourceFile,
        rowNumber,
        rawData: JSON.stringify(rawData),
        errorType: 'InvalidEnumValue',
        errorMessage: `字段 ${fieldName} 的值不在允许范围内`,
        fieldName,
        fieldValue: value,
        suggestion: `请从以下值中选择: ${allowedValues.join(', ')}`,
      });
    }
    return null;
  }
}

module.exports = Validator;
