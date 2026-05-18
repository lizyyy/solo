const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');

const REQUIRED_FIELDS = [
  '报销单号',
  '报销日期',
  '申请人',
  '部门',
  '原预算科目',
  '调拨后预算科目',
  '报销金额',
  '单据状态',
  '预算类型'
];

function parseFile(filePath) {
  return new Promise((resolve, reject) => {
    const ext = filePath.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
      parseCSV(filePath, resolve, reject);
    } else if (ext === 'xlsx' || ext === 'xls') {
      parseExcel(filePath, resolve, reject);
    } else {
      reject(new Error(`不支持的文件格式: ${ext}`));
    }
  });
}

function parseCSV(filePath, resolve, reject) {
  const results = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      resolve({
        records: results,
        metadata: {
          fileType: 'csv',
          recordCount: results.length,
          fields: Object.keys(results[0] || {})
        }
      });
    })
    .on('error', reject);
}

function parseExcel(filePath, resolve, reject) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    resolve({
      records: data,
      metadata: {
        fileType: 'excel',
        recordCount: data.length,
        fields: Object.keys(data[0] || {}),
        sheetName
      }
    });
  } catch (error) {
    reject(error);
  }
}

function validateFields(parsedData) {
  const errors = [];
  const { records } = parsedData;
  const { fields } = parsedData.metadata;
  
  const missingFields = REQUIRED_FIELDS.filter(f => !fields.includes(f));
  if (missingFields.length > 0) {
    errors.push({
      type: 'MISSING_FIELDS',
      message: `缺少必填字段: ${missingFields.join(', ')}`,
      severity: 'ERROR'
    });
  }
  
  records.forEach((record, index) => {
    const rowNum = index + 2;
    if (!record['报销单号']) {
      errors.push({
        type: 'EMPTY_REIMBURSEMENT_ID',
        message: `第 ${rowNum} 行: 报销单号为空`,
        row: rowNum,
        severity: 'ERROR'
      });
    }
    if (!record['报销金额']) {
      errors.push({
        type: 'EMPTY_AMOUNT',
        message: `第 ${rowNum} 行: 报销金额为空`,
        row: rowNum,
       报销单号: record['报销单号'],
        severity: 'WARNING'
      });
    }
  });
  
  return {
    isValid: errors.filter(e => e.severity === 'ERROR').length === 0,
    errors
  };
}

function transformRecords(records) {
  return records.map((record, index) => ({
    rowNumber: index + 2,
    报销单号: record['报销单号'] || '',
    报销日期: record['报销日期'] || '',
    申请人: record['申请人'] || '',
    部门: record['部门'] || '',
    原预算科目: record['原预算科目'] || '',
    调拨后预算科目: record['调拨后预算科目'] || '',
    报销金额: parseFloat(record['报销金额']) || 0,
    单据状态: record['单据状态'] || '',
    预算类型: record['预算类型'] || '',
    退款标记: record['退款标记'] || '',
    raw: record
  }));
}

module.exports = {
  parseFile,
  validateFields,
  transformRecords,
  REQUIRED_FIELDS
};
