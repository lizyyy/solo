const fs = require('fs');
const path = require('path');
const { CONFIG, ISSUE_TYPES } = require('./config');

const REQUIRED_FIELDS = [
  '账单编号',
  '用户ID',
  '计费月份',
  '数据用量_GB',
  '语音时长_分钟',
  '短信条数',
  '套餐费用',
  '减免金额',
  '实际支付',
];

class BillingParser {
  constructor() {
    this.issues = [];
    this.records = [];
    this.seenRecordKeys = new Set();
  }

  parseFile(filePath) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, CONFIG.ENCODING);
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      this.addIssue(ISSUE_TYPES.INVALID_FORMAT, fileName, 0, '文件内容为空或只有表头');
      return [];
    }

    const headers = this.parseCsvLine(lines[0]);
    const fieldValidation = this.validateHeaders(headers, fileName);
    if (!fieldValidation.valid) {
      this.addIssue(ISSUE_TYPES.MISSING_FIELDS, fileName, 1, fieldValidation.message);
    }

    const fileRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const lineNumber = i + 1;
      const rawValues = this.parseCsvLine(lines[i]);
      
      if (rawValues.length < headers.length) {
        this.addIssue(ISSUE_TYPES.INVALID_FORMAT, fileName, lineNumber, `字段数量不匹配，期望${headers.length}个，实际${rawValues.length}个`);
        continue;
      }

      const record = this.buildRecord(headers, rawValues, fileName, lineNumber);
      this.validateRecord(record, fileName, lineNumber);
      this.detectSpecialIssues(record, fileName, lineNumber);
      
      fileRecords.push(record);
      this.records.push(record);
    }

    return fileRecords;
  }

  parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  validateHeaders(headers, fileName) {
    const missingFields = REQUIRED_FIELDS.filter(f => !headers.includes(f));
    if (missingFields.length > 0) {
      return { valid: false, message: `缺少必需字段: ${missingFields.join(', ')}` };
    }
    return { valid: true };
  }

  buildRecord(headers, values, fileName, lineNumber) {
    const record = {
      _meta: { fileName, lineNumber, rawLine: values.join(',') },
    };
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    return record;
  }

  validateRecord(record, fileName, lineNumber) {
    const numericFields = ['数据用量_GB', '语音时长_分钟', '短信条数', '套餐费用', '减免金额', '实际支付'];
    numericFields.forEach(field => {
      const value = record[field];
      if (value === '' || value === undefined) {
        this.addIssue(ISSUE_TYPES.MISSING_FIELDS, fileName, lineNumber, `字段${field}为空`);
      } else if (isNaN(parseFloat(value))) {
        this.addIssue(ISSUE_TYPES.INVALID_NUMBER, fileName, lineNumber, `字段${field}数值无效: ${value}`);
      }
    });

    if (!record['计费月份'] || !/^\d{4}-\d{2}$/.test(record['计费月份'])) {
      this.addIssue(ISSUE_TYPES.INVALID_FORMAT, fileName, lineNumber, `计费月份格式无效: ${record['计费月份']}，期望格式: YYYY-MM`);
    }
  }

  detectSpecialIssues(record, fileName, lineNumber) {
    const recordKey = `${record['账单编号']}-${record['用户ID']}-${record['计费月份']}`;
    
    if (this.seenRecordKeys.has(recordKey)) {
      this.addIssue(ISSUE_TYPES.DUPLICATE_MEASUREMENT, fileName, lineNumber, `重复记录: 账单编号=${record['账单编号']}, 用户ID=${record['用户ID']}, 计费月份=${record['计费月份']}`);
    } else {
      this.seenRecordKeys.add(recordKey);
    }

    const numericFields = ['数据用量_GB', '语音时长_分钟', '短信条数', '套餐费用', '实际支付'];
    numericFields.forEach(field => {
      const value = parseFloat(record[field]);
      if (!isNaN(value) && value < 0) {
        this.addIssue(ISSUE_TYPES.NEGATIVE_REVERSAL, fileName, lineNumber, `负数冲正: ${field}=${value}`);
      }
    });

    const billingMonth = record['计费月份'];
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (billingMonth && billingMonth < currentMonth) {
      this.addIssue(ISSUE_TYPES.CROSS_MONTH_BACKFILL, fileName, lineNumber, `跨月补写: 计费月份=${billingMonth}，处理月份=${currentMonth}`);
    }
  }

  addIssue(type, fileName, lineNumber, message) {
    this.issues.push({
      type,
      fileName,
      lineNumber,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  getIssues() {
    return this.issues;
  }

  getRecords() {
    return this.records;
  }
}

module.exports = BillingParser;
