const chalk = require('chalk');

class RentalSettlementCalculator {
  constructor() {
    this.exceptions = [];
    this.warnings = [];
  }

  calculateSettlement(records, sourceFile = 'unknown') {
    this.exceptions = [];
    this.warnings = [];
    const results = [];

    records.forEach((record, index) => {
      const lineNumber = index + 2;
      try {
        const result = this.processRecord(record, sourceFile, lineNumber);
        results.push(result);
      } catch (error) {
        this.exceptions.push({
          sourceFile,
          lineNumber,
          record,
          error: error.message,
          suggestion: this.getRepairSuggestion(error.message, record)
        });
      }
    });

    return {
      results,
      exceptions: this.exceptions,
      warnings: this.warnings,
      summary: this.generateSummary(results)
    };
  }

  processRecord(record, sourceFile, lineNumber) {
    this.validateRequiredFields(record, sourceFile, lineNumber);

    const {
      orderId,
      customerName,
      cameraModel,
      lensModel,
      filterIncluded,
      rentalStartDate,
      rentalEndDate,
      dailyRate,
      depositAmount,
      actualReturnDate,
      itemsReturned,
      damageReported,
      notes
    } = record;

    const startDate = new Date(rentalStartDate);
    const endDate = new Date(rentalEndDate);
    const returnDate = actualReturnDate ? new Date(actualReturnDate) : endDate;

    const plannedDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const actualDays = Math.ceil((returnDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const baseRental = actualDays * parseFloat(dailyRate);
    const overdueDays = Math.max(0, actualDays - plannedDays);
    const overdueFee = overdueDays * parseFloat(dailyRate) * 1.5;

    const returnItems = this.parseItemsReturned(itemsReturned);
    const missingItems = this.detectMissingItems(cameraModel, lensModel, filterIncluded === '是', returnItems);

    const compensation = this.calculateCompensation(missingItems, damageReported === '是');

    const lensFilterMissing = missingItems.includes('滤镜');
    const isPartialReturn = returnItems.length > 0 && returnItems.length < (filterIncluded === '是' ? 3 : 2);

    if (isPartialReturn) {
      this.warnings.push({
        sourceFile,
        lineNumber,
        type: '分批归还',
        orderId,
        customerName,
        returnedItems: returnItems.join(', '),
        missingItems: missingItems.join(', '),
        suggestion: '请确认剩余物品归还时间，未归还物品将按日计算逾期费用'
      });
    }

    if (lensFilterMissing) {
      this.warnings.push({
        sourceFile,
        lineNumber,
        type: '镜头滤镜丢失',
        orderId,
        customerName,
        missingItems: '滤镜',
        compensationFee: compensation.filterFee || 0,
        suggestion: '已自动计算滤镜赔偿费用，可与客户协商是否免赔'
      });
    }

    const totalAmount = baseRental + overdueFee + compensation.total;
    const refundAmount = Math.max(0, parseFloat(depositAmount) - totalAmount);
    const payableAmount = Math.max(0, totalAmount - parseFloat(depositAmount));

    return {
      orderId,
      customerName,
      cameraModel,
      lensModel,
      rentalPeriod: {
        start: rentalStartDate,
        end: rentalEndDate,
        plannedDays,
        actualReturn: actualReturnDate || rentalEndDate,
        actualDays,
        overdueDays
      },
      pricing: {
        dailyRate: parseFloat(dailyRate),
        baseRental,
        overdueFee,
        compensation: compensation.total,
        compensationBreakdown: compensation.breakdown,
        totalAmount
      },
      deposit: {
        amount: parseFloat(depositAmount),
        refundAmount,
        payableAmount
      },
      returnStatus: {
        returnedItems: returnItems.join(', '),
        missingItems: missingItems.join(', '),
        isPartialReturn,
        lensFilterMissing,
        hasDamage: damageReported === '是'
      },
      notes: notes || ''
    };
  }

  validateRequiredFields(record, sourceFile, lineNumber) {
    const requiredFields = ['orderId', 'customerName', 'cameraModel', 'rentalStartDate', 'rentalEndDate', 'dailyRate', 'depositAmount'];
    const missing = requiredFields.filter(field => !record[field]);

    if (missing.length > 0) {
      throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    }

    if (isNaN(parseFloat(record.dailyRate)) || parseFloat(record.dailyRate) <= 0) {
      throw new Error(`日租金必须是正数，当前值: ${record.dailyRate}`);
    }

    if (isNaN(parseFloat(record.depositAmount)) || parseFloat(record.depositAmount) < 0) {
      throw new Error(`押金不能为负数，当前值: ${record.depositAmount}`);
    }
  }

  parseItemsReturned(itemsReturned) {
    if (!itemsReturned || itemsReturned.trim() === '') return [];
    return itemsReturned.split(/[，,、]/).map(item => item.trim()).filter(Boolean);
  }

  detectMissingItems(camera, lens, hasFilter, returnedItems) {
    const missing = [];
    const returnedLower = returnedItems.map(i => i.toLowerCase());

    if (!returnedLower.some(i => i.includes('相机') || i.includes(camera.toLowerCase()))) {
      missing.push('相机');
    }

    if (lens && !returnedLower.some(i => i.includes('镜头') || i.includes(lens.toLowerCase()))) {
      missing.push('镜头');
    }

    if (hasFilter && !returnedLower.some(i => i.includes('滤镜') || i.includes('uv'))) {
      missing.push('滤镜');
    }

    return missing;
  }

  calculateCompensation(missingItems, hasDamage) {
    const breakdown = [];
    let total = 0;

    if (missingItems.includes('相机')) {
      const fee = 5000;
      total += fee;
      breakdown.push({ item: '相机丢失', fee, note: '按相机价值50%赔偿' });
    }

    if (missingItems.includes('镜头')) {
      const fee = 2000;
      total += fee;
      breakdown.push({ item: '镜头丢失', fee, note: '按镜头价值50%赔偿' });
    }

    if (missingItems.includes('滤镜')) {
      const fee = 200;
      total += fee;
      breakdown.push({ item: '滤镜丢失', fee, note: '按全新价格赔偿' });
    }

    if (hasDamage) {
      const fee = 500;
      total += fee;
      breakdown.push({ item: '物品损坏', fee, note: '维修费用预估' });
    }

    return { total, breakdown, filterFee: missingItems.includes('滤镜') ? 200 : 0 };
  }

  getRepairSuggestion(errorMessage, record) {
    if (errorMessage.includes('缺少必填字段')) {
      const fields = errorMessage.match(/缺少必填字段: (.+)/)[1];
      return `请补充以下字段: ${fields}。参考订单号 ${record.orderId || '未知'} 的客户信息`;
    }
    if (errorMessage.includes('日租金')) {
      return '请输入有效的日租金金额（如：299），不能为负数或零';
    }
    if (errorMessage.includes('押金')) {
      return '请输入有效的押金金额（如：5000），不能为负数';
    }
    return '请检查数据格式是否正确';
  }

  generateSummary(results) {
    const totalOrders = results.length;
    const totalRevenue = results.reduce((sum, r) => sum + r.pricing.totalAmount, 0);
    const overdueOrders = results.filter(r => r.rentalPeriod.overdueDays > 0).length;
    const partialReturns = results.filter(r => r.returnStatus.isPartialReturn).length;
    const missingFilters = results.filter(r => r.returnStatus.lensFilterMissing).length;
    const damagedItems = results.filter(r => r.returnStatus.hasDamage).length;

    return {
      totalOrders,
      totalRevenue,
      overdueOrders,
      partialReturns,
      missingFilters,
      damagedItems
    };
  }

  canRerun() {
    return true;
  }
}

module.exports = RentalSettlementCalculator;
