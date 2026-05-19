const fs = require('fs');
const path = require('path');
const CompensationRule = require('../models/CompensationRule');
const Validator = require('../utils/Validator');
const BadRecord = require('../models/BadRecord');

class RuleImporter {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  import(filePath) {
    const results = {
      success: [],
      failed: [],
      total: 0,
    };

    const fileName = path.basename(filePath);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const rules = Array.isArray(data) ? data : [data];

      rules.forEach((rule, index) => {
        results.total++;
        const rowNumber = index + 1;
        const badRecord = this.validateRule(rule, rowNumber, fileName);
        
        if (badRecord) {
          results.failed.push(badRecord);
        } else {
          try {
            const compensationRule = new CompensationRule(rule);
            results.success.push(compensationRule);
          } catch (error) {
            const badRecord = new BadRecord({
              sourceType: 'rule',
              sourceFile: fileName,
              rowNumber,
              rawData: JSON.stringify(rule),
              errorType: 'ParseError',
              errorMessage: `解析规则数据失败: ${error.message}`,
              suggestion: '检查JSON格式和字段是否正确',
            });
            results.failed.push(badRecord);
          }
        }
      });

      if (results.success.length > 0) {
        this.dataStore.insertMany('rules', results.success);
      }
      if (results.failed.length > 0) {
        this.dataStore.insertMany('badRecords', results.failed);
      }
    } catch (error) {
      console.error('导入JSON文件出错:', error.message);
      if (error instanceof SyntaxError) {
        results.failed.push(new BadRecord({
          sourceType: 'rule',
          sourceFile: fileName,
          rowNumber: 0,
          rawData: '',
          errorType: 'InvalidJSON',
          errorMessage: `JSON格式错误: ${error.message}`,
          suggestion: '请使用JSON验证工具检查文件格式',
        }));
      }
    }

    return results;
  }

  validateRule(rule, rowNumber, fileName) {
    const requiredFields = ['ruleType', 'compensationType', 'description'];
    
    for (const field of requiredFields) {
      const error = Validator.validateRequired(
        rule[field],
        field,
        rule,
        rowNumber,
        fileName,
        'rule'
      );
      if (error) return error;
    }

    const validCompensationTypes = ['refund', 'coupon', 'exchange'];
    const compensationTypeError = Validator.validateEnum(
      rule.compensationType,
      'compensationType',
      validCompensationTypes,
      rule,
      rowNumber,
      fileName,
      'rule'
    );
    if (compensationTypeError) return compensationTypeError;

    if (rule.minShortageQuantity !== undefined) {
      const error = Validator.validateInteger(
        rule.minShortageQuantity,
        'minShortageQuantity',
        rule,
        rowNumber,
        fileName,
        'rule'
      );
      if (error) return error;
    }

    if (rule.compensationType === 'refund') {
      if (!rule.refundRate && rule.refundRate !== 0) {
        return new BadRecord({
          sourceType: 'rule',
          sourceFile: fileName,
          rowNumber,
          rawData: JSON.stringify(rule),
          errorType: 'MissingRequiredField',
          errorMessage: '退款类型规则需要 refundRate 字段',
          fieldName: 'refundRate',
          fieldValue: rule.refundRate,
          suggestion: '请添加退款比例，例如: 1.0 表示全额退款，0.5 表示半额退款',
        });
      }
      const error = Validator.validateNumber(
        rule.refundRate,
        'refundRate',
        rule,
        rowNumber,
        fileName,
        'rule'
      );
      if (error) return error;
    }

    if (rule.compensationType === 'coupon') {
      if (!rule.couponValue && rule.couponValue !== 0) {
        return new BadRecord({
          sourceType: 'rule',
          sourceFile: fileName,
          rowNumber,
          rawData: JSON.stringify(rule),
          errorType: 'MissingRequiredField',
          errorMessage: '优惠券类型规则需要 couponValue 字段',
          fieldName: 'couponValue',
          fieldValue: rule.couponValue,
          suggestion: '请添加优惠券面值，例如: 5, 10, 20',
        });
      }
      const error = Validator.validateNumber(
        rule.couponValue,
        'couponValue',
        rule,
        rowNumber,
        fileName,
        'rule'
      );
      if (error) return error;
    }

    if (rule.compensationType === 'exchange') {
      if (!rule.exchangeProductId) {
        return new BadRecord({
          sourceType: 'rule',
          sourceFile: fileName,
          rowNumber,
          rawData: JSON.stringify(rule),
          errorType: 'MissingRequiredField',
          errorMessage: '换货类型规则需要 exchangeProductId 字段',
          fieldName: 'exchangeProductId',
          fieldValue: rule.exchangeProductId,
          suggestion: '请添加换货商品ID',
        });
      }
    }

    return null;
  }
}

module.exports = RuleImporter;
