const _ = require('lodash');
const crypto = require('crypto');
const {
  getUniqueKeyField,
  getRequiredFields,
  getEnumField,
  getFieldByKey,
  getAllFields,
} = require('../utils/fieldDefinitions');
const {
  Customer,
  Product,
} = require('../models');

const ERROR_TYPES = {
  REQUIRED_MISSING: 'required_missing',
  ENUM_INVALID: 'enum_invalid',
  DUPLICATE: 'duplicate',
  MAPPING_CONFLICT: 'mapping_conflict',
  FORMAT_INVALID: 'format_invalid',
  BUSINESS_RULE: 'business_rule',
  SYSTEM_ERROR: 'system_error',
};

const STAGES = {
  PRECHECK: 'precheck',
  TRIAL_IMPORT: 'trial_import',
  FINAL_IMPORT: 'final_import',
};

function calculateFileHash(content) {
  return crypto
    .createHash('sha256')
    .update(typeof content === 'string' ? content : JSON.stringify(content))
    .digest('hex');
}

function parseCsv(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV文件至少需要包含表头和一行数据');
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.some(v => v !== '')) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

function applyMapping(rawRows, mappingConfig) {
  return rawRows.map(rawRow => {
    const mappedRow = {};
    Object.keys(mappingConfig).forEach(targetField => {
      const sourceColumn = mappingConfig[targetField];
      if (sourceColumn && rawRow[sourceColumn] !== undefined) {
        mappedRow[targetField] = rawRow[sourceColumn];
      }
    });
    return mappedRow;
  });
}

function validateRequiredFields(row, batchType, rowIndex) {
  const errors = [];
  const requiredFields = getRequiredFields(batchType);
  
  requiredFields.forEach(field => {
    const value = row[field.key];
    if (value === undefined || value === null || value === '') {
      errors.push({
        rowIndex,
        stage: STAGES.PRECHECK,
        errorType: ERROR_TYPES.REQUIRED_MISSING,
        fieldName: field.key,
        errorMessage: `字段"${field.label}"是必填项`,
        rawValue: value,
      });
    }
  });
  
  return errors;
}

function validateEnumFields(row, batchType, rowIndex) {
  const errors = [];
  const allFields = getAllFields(batchType);
  
  allFields
    .filter(f => f.type === 'enum' && f.enumValues)
    .forEach(field => {
      const value = row[field.key];
      if (value !== undefined && value !== null && value !== '') {
        if (!field.enumValues.includes(value)) {
          const validValues = field.enumLabels 
            ? field.enumLabels.join('/') 
            : field.enumValues.join('/');
          errors.push({
            rowIndex,
            stage: STAGES.PRECHECK,
            errorType: ERROR_TYPES.ENUM_INVALID,
            fieldName: field.key,
            errorMessage: `字段"${field.label}"的值"${value}"不合法，有效值为：${validValues}`,
            rawValue: value,
          });
        }
      }
    });
  
  return errors;
}

function validateFormatFields(row, batchType, rowIndex) {
  const errors = [];
  const allFields = getAllFields(batchType);
  
  allFields
    .filter(f => f.format)
    .forEach(field => {
      const value = row[field.key];
      if (value !== undefined && value !== null && value !== '') {
        if (field.format === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              rowIndex,
              stage: STAGES.PRECHECK,
              errorType: ERROR_TYPES.FORMAT_INVALID,
              fieldName: field.key,
              errorMessage: `字段"${field.label}"的值"${value}"不是有效的邮箱格式`,
              rawValue: value,
            });
          }
        }
      }
    });
  
  return errors;
}

function validateNumericFields(row, batchType, rowIndex) {
  const errors = [];
  const allFields = getAllFields(batchType);
  
  allFields
    .filter(f => f.type === 'number' || f.type === 'integer')
    .forEach(field => {
      const value = row[field.key];
      if (value !== undefined && value !== null && value !== '') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({
            rowIndex,
            stage: STAGES.PRECHECK,
            errorType: ERROR_TYPES.FORMAT_INVALID,
            fieldName: field.key,
            errorMessage: `字段"${field.label}"的值"${value}"不是有效的数字`,
            rawValue: value,
          });
        } else if (field.type === 'integer' && !Number.isInteger(num)) {
          errors.push({
            rowIndex,
            stage: STAGES.PRECHECK,
            errorType: ERROR_TYPES.FORMAT_INVALID,
            fieldName: field.key,
            errorMessage: `字段"${field.label}"的值"${value}"必须是整数`,
            rawValue: value,
          });
        } else if (field.min !== undefined && num < field.min) {
          errors.push({
            rowIndex,
            stage: STAGES.PRECHECK,
            errorType: ERROR_TYPES.FORMAT_INVALID,
            fieldName: field.key,
            errorMessage: `字段"${field.label}"的值"${value}"不能小于${field.min}`,
            rawValue: value,
          });
        }
      }
    });
  
  return errors;
}

function validateMappingConfig(mappingConfig, sourceColumns, batchType) {
  const errors = [];
  const targetFields = getAllFields(batchType).map(f => f.key);
  
  Object.keys(mappingConfig).forEach(targetField => {
    if (!targetFields.includes(targetField)) {
      errors.push({
        rowIndex: 0,
        stage: STAGES.PRECHECK,
        errorType: ERROR_TYPES.MAPPING_CONFLICT,
        fieldName: targetField,
        errorMessage: `目标字段"${targetField}"不存在于${batchType === 'customer' ? '客户' : '商品'}字段定义中`,
        rawValue: mappingConfig[targetField],
      });
    }
  });
  
  const uniqueKeyField = getUniqueKeyField(batchType);
  if (uniqueKeyField && !mappingConfig[uniqueKeyField.key]) {
    errors.push({
      rowIndex: 0,
      stage: STAGES.PRECHECK,
      errorType: ERROR_TYPES.MAPPING_CONFLICT,
      fieldName: uniqueKeyField.key,
      errorMessage: `必须映射唯一键字段"${uniqueKeyField.label}"`,
      rawValue: null,
    });
  }
  
  const usedSourceColumns = Object.values(mappingConfig);
  const duplicates = usedSourceColumns.filter(
    (col, idx) => col && usedSourceColumns.indexOf(col) !== idx
  );
  
  duplicates.forEach(col => {
    errors.push({
      rowIndex: 0,
      stage: STAGES.PRECHECK,
      errorType: ERROR_TYPES.MAPPING_CONFLICT,
      fieldName: col,
      errorMessage: `源列"${col}"被映射到多个目标字段`,
      rawValue: col,
    });
  });
  
  return errors;
}

function validateInternalDuplicates(mappedRows, batchType) {
  const errors = [];
  const uniqueKeyField = getUniqueKeyField(batchType);
  if (!uniqueKeyField) return errors;
  
  const seen = new Map();
  
  mappedRows.forEach((row, idx) => {
    const keyValue = row[uniqueKeyField.key];
    if (keyValue !== undefined && keyValue !== null && keyValue !== '') {
      if (seen.has(keyValue)) {
        errors.push({
          rowIndex: idx + 1,
          stage: STAGES.PRECHECK,
          errorType: ERROR_TYPES.DUPLICATE,
          fieldName: uniqueKeyField.key,
          errorMessage: `唯一键"${uniqueKeyField.label}"值"${keyValue}"在导入文件中重复（第${seen.get(keyValue) + 1}行）`,
          rawValue: keyValue,
        });
      } else {
        seen.set(keyValue, idx);
      }
    }
  });
  
  return errors;
}

async function validateDatabaseDuplicates(mappedRows, batchType) {
  const errors = [];
  const uniqueKeyField = getUniqueKeyField(batchType);
  if (!uniqueKeyField) return errors;
  
  const keyValues = mappedRows
    .map(r => r[uniqueKeyField.key])
    .filter(v => v !== undefined && v !== null && v !== '');
  
  if (keyValues.length === 0) return errors;
  
  const Model = batchType === 'customer' ? Customer : Product;
  const existingRecords = await Model.findAll({
    where: {
      [uniqueKeyField.key]: keyValues,
    },
    attributes: [uniqueKeyField.key],
  });
  
  const existingKeys = new Set(existingRecords.map(r => r[uniqueKeyField.key]));
  
  mappedRows.forEach((row, idx) => {
    const keyValue = row[uniqueKeyField.key];
    if (existingKeys.has(keyValue)) {
      errors.push({
        rowIndex: idx + 1,
        stage: STAGES.PRECHECK,
        errorType: ERROR_TYPES.DUPLICATE,
        fieldName: uniqueKeyField.key,
        errorMessage: `唯一键"${uniqueKeyField.label}"值"${keyValue}"已在数据库中存在`,
        rawValue: keyValue,
      });
    }
  });
  
  return errors;
}

async function precheckData(rawData, mappingConfig, batchType, sourceColumns) {
  const errors = [];
  
  const mappingErrors = validateMappingConfig(mappingConfig, sourceColumns, batchType);
  errors.push(...mappingErrors);
  
  if (mappingErrors.length > 0) {
    return {
      success: false,
      errors,
      totalRows: rawData.rows.length,
      validRows: 0,
      errorRows: mappingErrors.length,
      summary: {
        mappingErrors: mappingErrors.length,
        requiredErrors: 0,
        enumErrors: 0,
        formatErrors: 0,
        duplicateErrors: 0,
      },
    };
  }
  
  const mappedRows = applyMapping(rawData.rows, mappingConfig);
  
  const internalDupErrors = validateInternalDuplicates(mappedRows, batchType);
  errors.push(...internalDupErrors);
  
  const dbDupErrors = await validateDatabaseDuplicates(mappedRows, batchType);
  errors.push(...dbDupErrors);
  
  mappedRows.forEach((row, idx) => {
    const rowIndex = idx + 1;
    
    const requiredErrors = validateRequiredFields(row, batchType, rowIndex);
    errors.push(...requiredErrors);
    
    const enumErrors = validateEnumFields(row, batchType, rowIndex);
    errors.push(...enumErrors);
    
    const formatErrors = validateFormatFields(row, batchType, rowIndex);
    errors.push(...formatErrors);
    
    const numericErrors = validateNumericFields(row, batchType, rowIndex);
    errors.push(...numericErrors);
  });
  
  const errorRowIndices = new Set(errors.map(e => e.rowIndex).filter(i => i > 0));
  const validRows = mappedRows.length - errorRowIndices.size;
  
  const summary = {
    mappingErrors: mappingErrors.length,
    requiredErrors: errors.filter(e => e.errorType === ERROR_TYPES.REQUIRED_MISSING).length,
    enumErrors: errors.filter(e => e.errorType === ERROR_TYPES.ENUM_INVALID).length,
    formatErrors: errors.filter(e => e.errorType === ERROR_TYPES.FORMAT_INVALID).length,
    duplicateErrors: errors.filter(e => e.errorType === ERROR_TYPES.DUPLICATE).length,
  };
  
  return {
    success: errors.length === 0,
    errors,
    totalRows: mappedRows.length,
    validRows,
    errorRows: errorRowIndices.size,
    summary,
  };
}

function prepareRecordForImport(row, batchType) {
  const allFields = getAllFields(batchType);
  const record = {};
  
  allFields.forEach(field => {
    let value = row[field.key];
    
    if (value === undefined || value === null || value === '') {
      if (field.defaultValue !== undefined) {
        value = field.defaultValue;
      }
    }
    
    if (value !== undefined && value !== null) {
      if (field.type === 'number' && value !== '') {
        value = Number(value);
      } else if (field.type === 'integer' && value !== '') {
        value = parseInt(value, 10);
      }
      record[field.key] = value;
    }
  });
  
  return record;
}

function checkFileChanged(currentHash, storedHash) {
  return currentHash !== storedHash;
}

module.exports = {
  ERROR_TYPES,
  STAGES,
  calculateFileHash,
  parseCsv,
  applyMapping,
  validateRequiredFields,
  validateEnumFields,
  validateFormatFields,
  validateNumericFields,
  validateMappingConfig,
  validateInternalDuplicates,
  validateDatabaseDuplicates,
  precheckData,
  prepareRecordForImport,
  checkFileChanged,
};
