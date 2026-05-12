const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const path = require('path');

const REQUIRED_FIELDS = ['phone', 'name', 'amount', 'date'];
const FIELD_ALIASES = {
  '手机号': 'phone',
  '电话': 'phone',
  '手机号码': 'phone',
  '会员电话': 'phone',
  '姓名': 'name',
  '会员姓名': 'name',
  '名称': 'name',
  '金额': 'amount',
  '消费金额': 'amount',
  '消费': 'amount',
  '日期': 'date',
  '消费日期': 'date',
  '交易日期': 'date',
  '时间': 'date',
  '备注': 'note',
  '说明': 'note',
  '注释': 'note'
};

function getFieldName(header) {
  const trimmed = header.trim();
  if (FIELD_ALIASES[trimmed]) {
    return FIELD_ALIASES[trimmed];
  }
  if (FIELD_ALIASES[trimmed.replace(/\s/g, '')]) {
    return FIELD_ALIASES[trimmed.replace(/\s/g, '')];
  }
  const lower = trimmed.toLowerCase();
  if (REQUIRED_FIELDS.includes(lower)) {
    return lower;
  }
  return lower;
}

function detectHeaderConflicts(headers) {
  const fieldMap = {};
  const conflicts = [];
  
  headers.forEach((header, index) => {
    const fieldName = getFieldName(header);
    if (REQUIRED_FIELDS.includes(fieldName) || fieldName === 'note') {
      if (!fieldMap[fieldName]) {
        fieldMap[fieldName] = { originalHeaders: [header], indices: [index] };
      } else {
        fieldMap[fieldName].originalHeaders.push(header);
        fieldMap[fieldName].indices.push(index);
        conflicts.push({
          fieldName,
          originalHeaders: fieldMap[fieldName].originalHeaders
        });
      }
    }
  });
  
  return { fieldMap, conflicts };
}

function normalizeFields(row, fieldMap, rowIndex) {
  const normalized = {};
  const conflicts = [];
  
  for (const [key, value] of Object.entries(row)) {
    const fieldName = getFieldName(key);
    const trimmedValue = value === undefined || value === null ? '' : String(value).trim();
    
    if (REQUIRED_FIELDS.includes(fieldName) || fieldName === 'note') {
      if (normalized[fieldName] === undefined) {
        normalized[fieldName] = trimmedValue;
      } else {
        const existingValue = normalized[fieldName];
        if (existingValue !== '' && trimmedValue !== '' && existingValue !== trimmedValue) {
          conflicts.push({
            fieldName,
            value1: existingValue,
            value2: trimmedValue,
            row: rowIndex + 2
          });
        }
      }
    } else {
      normalized[fieldName] = trimmedValue;
    }
  }
  
  return { normalized, conflicts };
}

function parseAmount(value) {
  if (value === undefined || value === null) {
    return { valid: false, error: '金额为空' };
  }
  
  const str = String(value).trim();
  
  if (str === '') {
    return { valid: false, error: '金额为空' };
  }
  
  const cleanStr = str
    .replace(/[¥￥,]/g, '')
    .replace(/\s/g, '');
  
  if (cleanStr === '') {
    return { valid: false, error: `无法解析的金额格式: "${str}"` };
  }
  
  const amount = parseFloat(cleanStr);
  
  if (isNaN(amount) || !isFinite(amount)) {
    return { valid: false, error: `无法解析的金额格式: "${str}"` };
  }
  
  if (amount < 0) {
    return { valid: false, error: `金额不能为负数: ${amount}` };
  }
  
  return { valid: true, amount };
}

function validateRow(normalized, rowIndex) {
  const errors = [];
  
  const missingFields = REQUIRED_FIELDS.filter(f => 
    normalized[f] === undefined || normalized[f] === ''
  );
  
  if (missingFields.length > 0) {
    errors.push({
      type: 'missing_field',
      message: `缺少必要字段: ${missingFields.join(', ')}`,
      row: rowIndex + 2
    });
  }
  
  if (normalized.amount !== undefined && normalized.amount !== '') {
    const amountResult = parseAmount(normalized.amount);
    if (!amountResult.valid) {
      errors.push({
        type: 'invalid_amount',
        message: amountResult.error,
        row: rowIndex + 2,
        value: normalized.amount
      });
    } else {
      normalized.amount = amountResult.amount;
    }
  }
  
  return errors;
}

function collectConflictDetails(headerConflicts) {
  const details = [];
  headerConflicts.conflicts.forEach(conflict => {
    details.push(
      `字段 "${conflict.fieldName}" 存在多个同义列名: ${conflict.originalHeaders.map(h => `"${h}"`).join(', ')}`
    );
  });
  return details;
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let fieldMap = {};
    let headerConflicts = null;
    let headerProcessed = false;
    
    if (!fs.existsSync(filePath)) {
      return reject({ type: 'file_missing', message: '文件不存在' });
    }
    
    let originalHeaders = [];
    
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({
        mapHeaders: ({ header, index }) => {
          originalHeaders.push(header);
          return header;
        }
      }))
      .on('headers', (headers) => {
        headerProcessed = true;
        originalHeaders = headers;
        headerConflicts = detectHeaderConflicts(headers);
        fieldMap = headerConflicts.fieldMap;
        
        if (headerConflicts.conflicts.length > 0) {
          const conflictDetails = collectConflictDetails(headerConflicts);
          errors.push({
            type: 'field_conflict',
            message: `检测到字段冲突！以下同义字段同时存在，可能导致数据不一致：\n${conflictDetails.join('\n')}`,
            conflicts: headerConflicts.conflicts
          });
        }
        
        const normalizedHeaders = headers.map(h => getFieldName(h));
        const missingFields = REQUIRED_FIELDS.filter(f => !normalizedHeaders.includes(f));
        if (missingFields.length > 0) {
          errors.push({
            type: 'field_missing',
            message: `CSV文件缺少必要字段: ${missingFields.join(', ')}。请确保包含以下字段: phone/手机号、name/姓名、amount/金额、date/日期`
          });
        }
      })
      .on('data', (data) => {
        const rowIndex = results.length;
        const { normalized, conflicts } = normalizeFields(data, fieldMap, rowIndex);
        
        if (conflicts.length > 0) {
          conflicts.forEach(conflict => {
            errors.push({
              type: 'field_conflict',
              message: `第 ${conflict.row} 行字段 "${conflict.fieldName}" 值冲突: "${conflict.value1}" vs "${conflict.value2}"`,
              row: conflict.row,
              fieldName: conflict.fieldName,
              value1: conflict.value1,
              value2: conflict.value2
            });
          });
        }
        
        const validationErrors = validateRow(normalized, rowIndex);
        errors.push(...validationErrors);
        
        results.push(normalized);
      })
      .on('end', () => {
        if (errors.length > 0) {
          reject({
            type: 'validation_error',
            message: '文件解析过程中发现错误',
            errors,
            data: results
          });
        } else {
          resolve(results);
        }
      })
      .on('error', (err) => {
        reject({ type: 'parse_error', message: `CSV解析错误: ${err.message}` });
      });
  });
}

function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    const errors = [];
    
    if (!fs.existsSync(filePath)) {
      return reject({ type: 'file_missing', message: '文件不存在' });
    }
    
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (data.length > 0) {
        const firstRow = data[0];
        const headers = Object.keys(firstRow);
        const headerConflicts = detectHeaderConflicts(headers);
        const fieldMap = headerConflicts.fieldMap;
        
        if (headerConflicts.conflicts.length > 0) {
          const conflictDetails = collectConflictDetails(headerConflicts);
          errors.push({
            type: 'field_conflict',
            message: `检测到字段冲突！以下同义字段同时存在，可能导致数据不一致：\n${conflictDetails.join('\n')}`,
            conflicts: headerConflicts.conflicts
          });
        }
        
        const normalizedHeaders = headers.map(h => getFieldName(h));
        const missingFields = REQUIRED_FIELDS.filter(f => !normalizedHeaders.includes(f));
        if (missingFields.length > 0) {
          errors.push({
            type: 'field_missing',
            message: `Excel文件缺少必要字段: ${missingFields.join(', ')}。请确保包含以下字段: phone/手机号、name/姓名、amount/金额、date/日期`
          });
        }
        
        const results = data.map((row, rowIndex) => {
          const { normalized, conflicts } = normalizeFields(row, fieldMap, rowIndex);
          
          if (conflicts.length > 0) {
            conflicts.forEach(conflict => {
              errors.push({
                type: 'field_conflict',
                message: `第 ${conflict.row} 行字段 "${conflict.fieldName}" 值冲突: "${conflict.value1}" vs "${conflict.value2}"`,
                row: conflict.row,
                fieldName: conflict.fieldName,
                value1: conflict.value1,
                value2: conflict.value2
              });
            });
          }
          
          const validationErrors = validateRow(normalized, rowIndex);
          errors.push(...validationErrors);
          
          return normalized;
        });
        
        if (errors.length > 0) {
          reject({
            type: 'validation_error',
            message: '文件解析过程中发现错误',
            errors,
            data: results
          });
        } else {
          resolve(results);
        }
      } else {
        resolve([]);
      }
    } catch (err) {
      reject({ type: 'parse_error', message: `Excel解析错误: ${err.message}` });
    }
  });
}

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.csv':
      return parseCSV(filePath);
    case '.xlsx':
    case '.xls':
      return parseExcel(filePath);
    default:
      return Promise.reject({ 
        type: 'unsupported_format', 
        message: '不支持的文件格式，请上传CSV或Excel文件(.csv, .xlsx, .xls)' 
      });
  }
}

function exportToExcel(records, outputPath) {
  const data = records.map(r => ({
    '手机号': r.phone,
    '姓名': r.name,
    '系统会员名': r.memberName || '-',
    '金额': r.amount,
    '日期': r.date,
    '备注': r.note || '-',
    '状态': getStatusText(r.status),
    '来源文件': r.importedFrom,
    '导入时间': r.importedAt
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '会员消费记录');
  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

function exportToCSV(records, outputPath) {
  const headers = ['手机号', '姓名', '系统会员名', '金额', '日期', '备注', '状态', '来源文件', '导入时间'];
  const rows = records.map(r => [
    r.phone,
    r.name,
    r.memberName || '-',
    r.amount,
    r.date,
    r.note || '-',
    getStatusText(r.status),
    r.importedFrom,
    r.importedAt
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  fs.writeFileSync(outputPath, csvContent, 'utf8');
  return outputPath;
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已拒绝'
  };
  return statusMap[status] || status;
}

module.exports = {
  parseFile,
  exportToExcel,
  exportToCSV,
  parseAmount,
  getFieldName,
  detectHeaderConflicts,
  REQUIRED_FIELDS
};
