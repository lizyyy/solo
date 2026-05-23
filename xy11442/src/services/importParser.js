const csv = require('csv-parser');
const fs = require('fs');
const logger = require('../config/logger');

class ImportParser {
  static parseCSV(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv(options))
        .on('data', (data) => {
          rowNumber++;
          results.push({
            rowNumber,
            originalData: { ...data },
            data,
          });
        })
        .on('error', (error) => {
          logger.error('CSV解析错误:', error);
          reject(error);
        })
        .on('end', () => {
          logger.info(`CSV解析完成，共 ${rowNumber} 行`);
          resolve({ rows: results, errors, totalRows: rowNumber });
        });
    });
  }

  static normalizeDeliveryRow(row) {
    const data = row.data;
    const normalized = {
      deliveryNo: this.cleanString(data['送货单号'] || data['deliveryNo'] || data['delivery_no']),
      supplierId: this.cleanString(data['供应商ID'] || data['supplierId'] || data['supplier_id']),
      supplierName: this.cleanString(data['供应商名称'] || data['supplierName'] || data['supplier_name']),
      deliveryDate: this.parseDate(data['送货日期'] || data['deliveryDate'] || data['delivery_date']),
      productId: this.cleanString(data['商品ID'] || data['productId'] || data['product_id']),
      productName: this.cleanString(data['商品名称'] || data['productName'] || data['product_name']),
      deliveryQuantity: this.parseDecimal(data['送货数量'] || data['deliveryQuantity'] || data['delivery_quantity']),
      unit: this.cleanString(data['单位'] || data['unit']) || 'kg',
      unitPrice: this.parseDecimal(data['单价'] || data['unitPrice'] || data['unit_price']),
      totalAmount: this.parseDecimal(data['总金额'] || data['totalAmount'] || data['total_amount']),
    };

    const validation = this.validateDeliveryRow(normalized);
    
    return {
      ...normalized,
      parseStatus: validation.valid ? 'success' : (validation.hasWarning ? 'warning' : 'failed'),
      parseNote: validation.message,
    };
  }

  static normalizeWeighingRow(row) {
    const data = row.data;
    const normalized = {
      weighingNo: this.cleanString(data['称重单号'] || data['weighingNo'] || data['weighing_no']),
      deliveryNo: this.cleanString(data['送货单号'] || data['deliveryNo'] || data['delivery_no']),
      supplierId: this.cleanString(data['供应商ID'] || data['supplierId'] || data['supplier_id']),
      productId: this.cleanString(data['商品ID'] || data['productId'] || data['product_id']),
      productName: this.cleanString(data['商品名称'] || data['productName'] || data['product_name']),
      weighingDate: this.parseDate(data['称重日期'] || data['weighingDate'] || data['weighing_date']),
      grossWeight: this.parseDecimal(data['毛重'] || data['grossWeight'] || data['gross_weight']),
      tareWeight: this.parseDecimal(data['皮重'] || data['tareWeight'] || data['tare_weight']),
      netWeight: this.parseDecimal(data['净重'] || data['netWeight'] || data['net_weight']),
      unit: this.cleanString(data['单位'] || data['unit']) || 'kg',
      weigher: this.cleanString(data['称重人'] || data['weigher']),
    };

    const validation = this.validateWeighingRow(normalized);
    
    return {
      ...normalized,
      parseStatus: validation.valid ? 'success' : (validation.hasWarning ? 'warning' : 'failed'),
      parseNote: validation.message,
    };
  }

  static normalizeBasketReturnRow(row) {
    const data = row.data;
    const normalized = {
      returnNo: this.cleanString(data['退筐单号'] || data['returnNo'] || data['return_no']),
      deliveryNo: this.cleanString(data['送货单号'] || data['deliveryNo'] || data['delivery_no']),
      supplierId: this.cleanString(data['供应商ID'] || data['supplierId'] || data['supplier_id']),
      productId: this.cleanString(data['商品ID'] || data['productId'] || data['product_id']),
      returnDate: this.parseDate(data['退筐日期'] || data['returnDate'] || data['return_date']),
      basketCount: this.parseInt(data['退筐数量'] || data['basketCount'] || data['basket_count']),
      badFruitWeight: this.parseDecimal(data['坏果重量'] || data['badFruitWeight'] || data['bad_fruit_weight']),
      unit: this.cleanString(data['单位'] || data['unit']) || 'kg',
      photoUrl: this.cleanString(data['照片路径'] || data['photoUrl'] || data['photo_url']),
      returnReason: this.cleanString(data['退回原因'] || data['returnReason'] || data['return_reason']),
    };

    const validation = this.validateBasketReturnRow(normalized);
    
    return {
      ...normalized,
      parseStatus: validation.valid ? 'success' : (validation.hasWarning ? 'warning' : 'failed'),
      parseNote: validation.message,
    };
  }

  static validateDeliveryRow(row) {
    const messages = [];
    let hasWarning = false;

    if (!row.deliveryNo) messages.push('送货单号不能为空');
    if (!row.supplierId) messages.push('供应商ID不能为空');
    if (!row.supplierName) messages.push('供应商名称不能为空');
    if (!row.deliveryDate) messages.push('送货日期不能为空或格式错误');
    if (!row.productId) messages.push('商品ID不能为空');
    if (!row.productName) messages.push('商品名称不能为空');
    if (row.deliveryQuantity === null) messages.push('送货数量不能为空或格式错误');
    if (row.unitPrice === null) messages.push('单价不能为空或格式错误');
    if (row.totalAmount === null) messages.push('总金额不能为空或格式错误');

    if (row.deliveryQuantity !== null && row.unitPrice !== null && row.totalAmount !== null) {
      const calculated = Number((row.deliveryQuantity * row.unitPrice).toFixed(2));
      if (Math.abs(calculated - row.totalAmount) > 0.01) {
        messages.push(`警告: 数量x单价(${calculated})与总金额(${row.totalAmount})不符`);
        hasWarning = true;
      }
    }

    return {
      valid: messages.length === 0 || (hasWarning && messages.filter(m => !m.startsWith('警告')).length === 0),
      hasWarning,
      message: messages.join('; '),
    };
  }

  static validateWeighingRow(row) {
    const messages = [];
    let hasWarning = false;

    if (!row.weighingNo) messages.push('称重单号不能为空');
    if (!row.productId) messages.push('商品ID不能为空');
    if (!row.productName) messages.push('商品名称不能为空');
    if (!row.weighingDate) messages.push('称重日期不能为空或格式错误');
    if (row.netWeight === null) messages.push('净重不能为空或格式错误');

    if (row.grossWeight !== null && row.tareWeight !== null && row.netWeight !== null) {
      const calculated = Number((row.grossWeight - row.tareWeight).toFixed(2));
      if (Math.abs(calculated - row.netWeight) > 0.01) {
        messages.push(`警告: 毛重-皮重(${calculated})与净重(${row.netWeight})不符`);
        hasWarning = true;
      }
    }

    return {
      valid: messages.length === 0 || (hasWarning && messages.filter(m => !m.startsWith('警告')).length === 0),
      hasWarning,
      message: messages.join('; '),
    };
  }

  static validateBasketReturnRow(row) {
    const messages = [];

    if (!row.returnNo) messages.push('退筐单号不能为空');
    if (!row.returnDate) messages.push('退筐日期不能为空或格式错误');

    return {
      valid: messages.length === 0,
      hasWarning: false,
      message: messages.join('; '),
    };
  }

  static cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  static parseDecimal(value) {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : Number(parsed.toFixed(2));
  }

  static parseInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[^\d-]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
  }

  static parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
}

module.exports = ImportParser;
