const XLSX = require('xlsx');
const path = require('path');
const Shortage = require('../models/Shortage');
const Validator = require('../utils/Validator');
const BadRecord = require('../models/BadRecord');

class ShortageImporter {
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
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      data.forEach((row, index) => {
        results.total++;
        const rowNumber = index + 2;
        const badRecord = this.validateRow(row, rowNumber, fileName);
        
        if (badRecord) {
          results.failed.push(badRecord);
        } else {
          try {
            const shortage = new Shortage({
              productId: row.productId,
              productName: row.productName,
              shortageDate: row.shortageDate,
              expectedQuantity: row.expectedQuantity,
              actualQuantity: row.actualQuantity,
              shortageQuantity: row.shortageQuantity,
              supplierId: row.supplierId,
              supplierName: row.supplierName,
              reason: row.reason,
            });
            results.success.push(shortage);
          } catch (error) {
            const badRecord = new BadRecord({
              sourceType: 'shortage',
              sourceFile: fileName,
              rowNumber,
              rawData: JSON.stringify(row),
              errorType: 'ParseError',
              errorMessage: `解析缺货数据失败: ${error.message}`,
              suggestion: '检查数据格式是否正确',
            });
            results.failed.push(badRecord);
          }
        }
      });

      if (results.success.length > 0) {
        this.dataStore.insertMany('shortages', results.success);
      }
      if (results.failed.length > 0) {
        this.dataStore.insertMany('badRecords', results.failed);
      }
    } catch (error) {
      console.error('导入Excel文件出错:', error.message);
    }

    return results;
  }

  validateRow(data, rowNumber, fileName) {
    const requiredFields = ['productId', 'productName', 'shortageDate', 'expectedQuantity', 'actualQuantity', 'shortageQuantity'];
    
    for (const field of requiredFields) {
      const error = Validator.validateRequired(
        data[field],
        field,
        data,
        rowNumber,
        fileName,
        'shortage'
      );
      if (error) return error;
    }

    const integerFields = ['expectedQuantity', 'actualQuantity', 'shortageQuantity'];
    for (const field of integerFields) {
      const error = Validator.validateInteger(
        data[field],
        field,
        data,
        rowNumber,
        fileName,
        'shortage'
      );
      if (error) return error;
    }

    const dateError = Validator.validateDate(
      data.shortageDate,
      'shortageDate',
      data,
      rowNumber,
      fileName,
      'shortage'
    );
    if (dateError) return dateError;

    const expectedShortage = parseInt(data.expectedQuantity, 10) - parseInt(data.actualQuantity, 10);
    const actualShortage = parseInt(data.shortageQuantity, 10);
    if (Math.abs(expectedShortage - actualShortage) > 0) {
      return new BadRecord({
        sourceType: 'shortage',
        sourceFile: fileName,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'QuantityMismatch',
        errorMessage: `缺货数量计算错误: 预期 ${expectedShortage}, 实际 ${actualShortage}`,
        fieldName: 'shortageQuantity',
        fieldValue: data.shortageQuantity,
        suggestion: `请修正缺货数量为 ${expectedShortage} (预期数量 - 实际数量)`,
      });
    }

    if (actualShortage < 0) {
      return new BadRecord({
        sourceType: 'shortage',
        sourceFile: fileName,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'NegativeShortage',
        errorMessage: `缺货数量不能为负数: ${actualShortage}`,
        fieldName: 'shortageQuantity',
        fieldValue: data.shortageQuantity,
        suggestion: '请检查预期数量和实际数量',
      });
    }

    return null;
  }
}

module.exports = ShortageImporter;
