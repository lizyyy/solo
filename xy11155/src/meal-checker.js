const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const logger = require('./logger');
const { DataValidationError, FileReadError, InvalidFormatError } = require('./errors');

class MealChecker {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.fileName = path.basename(filePath);
    this.options = options;
    this.records = [];
    this.errors = [];
    this.warnings = [];
    this.summary = {
      totalRecords: 0,
      twinOrders: [],
      temporaryRestrictions: [],
      validRecords: 0,
      invalidRecords: 0
    };
  }

  async run() {
    logger.verbose(`开始读取文件: ${this.filePath}`);
    
    try {
      await this.readCSV();
    } catch (error) {
      throw new FileReadError(`无法读取文件: ${error.message}`, this.filePath, error);
    }

    logger.verbose(`共读取 ${this.records.length} 条记录`);
    
    this.validateRecords();
    this.detectSpecialOrders();
    this.generateSummary();

    return {
      records: this.records,
      errors: this.errors,
      warnings: this.warnings,
      summary: this.summary
    };
  }

  readCSV() {
    return new Promise((resolve, reject) => {
      const results = [];
      let lineNumber = 1;

      fs.createReadStream(this.filePath, 'utf8')
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim()
        }))
        .on('headers', (headers) => {
          lineNumber++;
          logger.verbose(`CSV表头: ${headers.join(', ')}`);
          this.validateHeaders(headers, lineNumber);
        })
        .on('data', (data) => {
          lineNumber++;
          data._lineNumber = lineNumber;
          results.push(data);
        })
        .on('end', () => {
          this.records = results;
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  validateHeaders(headers, lineNumber) {
    const requiredHeaders = ['订单编号', '客户姓名', '联系电话', '配送日期', '餐次', '配送地址'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new InvalidFormatError(
        `CSV缺少必要的表头列`,
        this.fileName,
        1,
        `必须包含: ${requiredHeaders.join(', ')}`,
        `缺少: ${missingHeaders.join(', ')}`
      );
    }
  }

  validateRecords() {
    logger.section('记录校验');
    
    for (const record of this.records) {
      const lineNumber = record._lineNumber;
      
      this.validateRequiredField(record, '订单编号', lineNumber);
      this.validateRequiredField(record, '客户姓名', lineNumber);
      this.validateRequiredField(record, '联系电话', lineNumber);
      this.validateRequiredField(record, '配送日期', lineNumber);
      this.validateRequiredField(record, '餐次', lineNumber);
      this.validateRequiredField(record, '配送地址', lineNumber);
      
      this.validatePhone(record, lineNumber);
      this.validateDate(record, lineNumber);
      this.validateMealTime(record, lineNumber);
    }

    this.summary.validRecords = this.records.length - this.errors.filter(e => e.name === 'DataValidationError').length;
    this.summary.invalidRecords = this.errors.filter(e => e.name === 'DataValidationError').length;
  }

  validateRequiredField(record, field, lineNumber) {
    const value = record[field];
    if (!value || value.toString().trim() === '') {
      const error = new DataValidationError(
        `必填字段为空`,
        this.fileName,
        lineNumber,
        field,
        value
      );
      this.errors.push(error);
      logger.verbose(`校验失败 [行${lineNumber}]: ${field} 为空`);
    }
  }

  validatePhone(record, lineNumber) {
    const phone = record['联系电话'];
    if (phone && !/^1[3-9]\d{9}$/.test(phone.toString().trim())) {
      const error = new DataValidationError(
        `手机号格式不正确`,
        this.fileName,
        lineNumber,
        '联系电话',
        phone
      );
      this.errors.push(error);
      logger.verbose(`校验失败 [行${lineNumber}]: 手机号格式错误 ${phone}`);
    }
  }

  validateDate(record, lineNumber) {
    const date = record['配送日期'];
    if (date) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        const error = new DataValidationError(
          `配送日期格式不正确`,
          this.fileName,
          lineNumber,
          '配送日期',
          date
        );
        this.errors.push(error);
        logger.verbose(`校验失败 [行${lineNumber}]: 日期格式错误 ${date}`);
      }
    }
  }

  validateMealTime(record, lineNumber) {
    const mealTime = record['餐次'];
    const validMealTimes = ['早餐', '午餐', '晚餐', '加餐'];
    if (mealTime && !validMealTimes.includes(mealTime.trim())) {
      const warning = new DataValidationError(
        `餐次不在标准范围内`,
        this.fileName,
        lineNumber,
        '餐次',
        mealTime
      );
      this.warnings.push(warning);
      logger.verbose(`警告 [行${lineNumber}]: 餐次不标准 ${mealTime}`);
    }
  }

  detectSpecialOrders() {
    logger.section('特殊订单识别');
    
    for (const record of this.records) {
      const lineNumber = record._lineNumber;
      
      this.detectTwinOrder(record, lineNumber);
      this.detectTemporaryRestriction(record, lineNumber);
    }

    logger.verbose(`识别到双胞胎订单: ${this.summary.twinOrders.length} 个`);
    logger.verbose(`识别到临时忌口订单: ${this.summary.temporaryRestrictions.length} 个`);
  }

  detectTwinOrder(record, lineNumber) {
    const isTwin = this.checkTwinKeywords(record);
    
    if (isTwin) {
      const twinInfo = {
        orderId: record['订单编号'],
        customerName: record['客户姓名'],
        lineNumber: lineNumber,
        sourceFields: isTwin.fields
      };
      this.summary.twinOrders.push(twinInfo);
      logger.verbose(`双胞胎订单 [行${lineNumber}]: ${record['订单编号']} - ${record['客户姓名']}`);
    }
  }

  checkTwinKeywords(record) {
    const twinKeywords = ['双胞胎', '双胎', '两个宝宝', '双宝', '龙凤胎'];
    const fieldsToCheck = ['备注', '特殊要求', '客户姓名', '订单编号'];
    const matchedFields = [];

    for (const field of fieldsToCheck) {
      const value = record[field];
      if (value && twinKeywords.some(keyword => value.toString().includes(keyword))) {
        matchedFields.push(field);
      }
    }

    return matchedFields.length > 0 ? { fields: matchedFields } : null;
  }

  detectTemporaryRestriction(record, lineNumber) {
    const restrictions = this.checkRestrictionKeywords(record);
    
    if (restrictions.length > 0) {
      const restrictionInfo = {
        orderId: record['订单编号'],
        customerName: record['客户姓名'],
        lineNumber: lineNumber,
        restrictions: restrictions,
        sourceFields: restrictions.map(r => r.field)
      };
      this.summary.temporaryRestrictions.push(restrictionInfo);
      logger.verbose(`临时忌口 [行${lineNumber}]: ${record['订单编号']} - ${restrictions.map(r => r.keyword).join(', ')}`);
    }
  }

  checkRestrictionKeywords(record) {
    const restrictionKeywords = [
      { keyword: '姜', type: '忌姜' },
      { keyword: '酒', type: '忌酒' },
      { keyword: '海鲜', type: '忌海鲜' },
      { keyword: '辣', type: '忌辣' },
      { keyword: '葱', type: '忌葱' },
      { keyword: '蒜', type: '忌蒜' },
      { keyword: '香菜', type: '忌香菜' },
      { keyword: '牛肉', type: '忌牛肉' },
      { keyword: '羊肉', type: '忌羊肉' },
      { keyword: '生冷', type: '忌生冷' },
      { keyword: '低糖', type: '低糖' },
      { keyword: '素食', type: '素食' },
      { keyword: '过敏', type: '过敏源' }
    ];
    
    const fieldsToCheck = ['备注', '特殊要求', '忌口说明', '饮食禁忌'];
    const foundRestrictions = [];

    for (const field of fieldsToCheck) {
      const value = record[field];
      if (value) {
        const valueStr = value.toString();
        for (const { keyword, type } of restrictionKeywords) {
          if (valueStr.includes(keyword) && !foundRestrictions.some(r => r.keyword === keyword)) {
            foundRestrictions.push({
              keyword: keyword,
              type: type,
              field: field
            });
          }
        }
      }
    }

    return foundRestrictions;
  }

  generateSummary() {
    this.summary.totalRecords = this.records.length;
  }
}

module.exports = MealChecker;
