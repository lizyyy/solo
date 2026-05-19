const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const Order = require('../models/Order');
const Validator = require('../utils/Validator');

class OrderImporter {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  async import(filePath) {
    const results = {
      success: [],
      failed: [],
      total: 0,
    };

    return new Promise((resolve) => {
      const fileName = path.basename(filePath);
      let rowNumber = 1;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', () => {
          rowNumber++;
        })
        .on('data', (data) => {
          results.total++;
          const badRecord = this.validateRow(data, rowNumber, fileName);
          
          if (badRecord) {
            results.failed.push(badRecord);
          } else {
            try {
              const order = new Order({
                orderNo: data.orderNo,
                userId: data.userId,
                userName: data.userName,
                phone: data.phone,
                groupLeaderId: data.groupLeaderId,
                groupLeaderName: data.groupLeaderName,
                productId: data.productId,
                productName: data.productName,
                quantity: data.quantity,
                unitPrice: data.unitPrice,
                totalAmount: data.totalAmount,
                paymentTime: data.paymentTime,
              });
              results.success.push(order);
            } catch (error) {
              const badRecord = new (require('../models/BadRecord'))({
                sourceType: 'order',
                sourceFile: fileName,
                rowNumber,
                rawData: JSON.stringify(data),
                errorType: 'ParseError',
                errorMessage: `解析订单数据失败: ${error.message}`,
                suggestion: '检查数据格式是否正确',
              });
              results.failed.push(badRecord);
            }
          }
          rowNumber++;
        })
        .on('end', () => {
          if (results.success.length > 0) {
            this.dataStore.insertMany('orders', results.success);
          }
          if (results.failed.length > 0) {
            this.dataStore.insertMany('badRecords', results.failed);
          }
          resolve(results);
        })
        .on('error', (error) => {
          console.error('导入CSV文件出错:', error.message);
          resolve(results);
        });
    });
  }

  validateRow(data, rowNumber, fileName) {
    const requiredFields = ['orderNo', 'userId', 'userName', 'phone', 'productId', 'productName', 'quantity', 'unitPrice', 'totalAmount'];
    
    for (const field of requiredFields) {
      const error = Validator.validateRequired(
        data[field],
        field,
        data,
        rowNumber,
        fileName,
        'order'
      );
      if (error) return error;
    }

    const integerFields = ['quantity'];
    for (const field of integerFields) {
      const error = Validator.validateInteger(
        data[field],
        field,
        data,
        rowNumber,
        fileName,
        'order'
      );
      if (error) return error;
    }

    const numberFields = ['unitPrice', 'totalAmount'];
    for (const field of numberFields) {
      const error = Validator.validateNumber(
        data[field],
        field,
        data,
        rowNumber,
        fileName,
        'order'
      );
      if (error) return error;
    }

    const phoneError = Validator.validatePhone(
      data.phone,
      'phone',
      data,
      rowNumber,
      fileName,
      'order'
    );
    if (phoneError) return phoneError;

    if (data.paymentTime) {
      const dateError = Validator.validateDate(
        data.paymentTime,
        'paymentTime',
        data,
        rowNumber,
        fileName,
        'order'
      );
      if (dateError) return dateError;
    }

    const expectedTotal = parseFloat(data.quantity) * parseFloat(data.unitPrice);
    const actualTotal = parseFloat(data.totalAmount);
    if (Math.abs(expectedTotal - actualTotal) > 0.01) {
      return new (require('../models/BadRecord'))({
        sourceType: 'order',
        sourceFile: fileName,
        rowNumber,
        rawData: JSON.stringify(data),
        errorType: 'AmountMismatch',
        errorMessage: `总金额计算错误: 预期 ${expectedTotal.toFixed(2)}, 实际 ${actualTotal.toFixed(2)}`,
        fieldName: 'totalAmount',
        fieldValue: data.totalAmount,
        suggestion: `请修正总金额为 ${expectedTotal.toFixed(2)} (数量 × 单价)`,
      });
    }

    return null;
  }
}

module.exports = OrderImporter;
