const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const Order = require('../models/Order');
const Shortage = require('../models/Shortage');
const Compensation = require('../models/Compensation');
const CompensationRule = require('../models/CompensationRule');
const BadRecord = require('../models/BadRecord');
const DataStore = require('../utils/DataStore');

class ReportService {
  constructor(dataDir) {
    this.dataStore = new DataStore(dataDir || path.join(__dirname, '../data'));
  }

  generateCompensationSummary() {
    const compensations = this.dataStore.findAll('compensations', Compensation);
    
    const summary = {
      total: compensations.length,
      byType: {
        refund: compensations.filter(c => c.compensationType === 'refund').length,
        coupon: compensations.filter(c => c.compensationType === 'coupon').length,
        exchange: compensations.filter(c => c.compensationType === 'exchange').length,
      },
      byStatus: {
        pending: compensations.filter(c => c.status === 'pending').length,
        approved: compensations.filter(c => c.status === 'approved').length,
        executed: compensations.filter(c => c.status === 'executed').length,
        failed: compensations.filter(c => c.status === 'failed').length,
      },
      totalRefundAmount: compensations
        .filter(c => c.refundAmount)
        .reduce((sum, c) => sum + c.refundAmount, 0),
      totalCouponValue: compensations
        .filter(c => c.couponValue)
        .reduce((sum, c) => sum + c.couponValue, 0),
      totalExchangeItems: compensations
        .filter(c => c.exchangeQuantity)
        .reduce((sum, c) => sum + c.exchangeQuantity, 0),
    };

    return summary;
  }

  generateShortageSummary() {
    const shortages = this.dataStore.findAll('shortages', Shortage);
    
    return {
      total: shortages.length,
      totalShortageQuantity: shortages.reduce((sum, s) => sum + s.shortageQuantity, 0),
      byProduct: shortages.map(s => ({
        productId: s.productId,
        productName: s.productName,
        quantity: s.shortageQuantity,
      })),
    };
  }

  generateBadRecordsSummary() {
    const badRecords = this.dataStore.findAll('badRecords', BadRecord);
    
    return {
      total: badRecords.length,
      bySource: {
        order: badRecords.filter(b => b.sourceType === 'order').length,
        shortage: badRecords.filter(b => b.sourceType === 'shortage').length,
        rule: badRecords.filter(b => b.sourceType === 'rule').length,
      },
      byStatus: {
        unresolved: badRecords.filter(b => b.status === 'unresolved').length,
        resolved: badRecords.filter(b => b.status === 'resolved').length,
      },
      byErrorType: badRecords.reduce((acc, b) => {
        acc[b.errorType] = (acc[b.errorType] || 0) + 1;
        return acc;
      }, {}),
    };
  }

  generateFullReport() {
    return {
      generatedAt: new Date().toISOString(),
      compensation: this.generateCompensationSummary(),
      shortage: this.generateShortageSummary(),
      badRecords: this.generateBadRecordsSummary(),
    };
  }

  exportCompensationsToCSV(filePath, status = null) {
    const compensations = this.dataStore.find(
      'compensations',
      c => !status || c.status === status,
      Compensation
    );

    const fields = [
      'id', 'orderNo', 'userId', 'userName', 'phone',
      'productId', 'productName', 'shortageQuantity',
      'compensationType', 'refundAmount', 'couponId', 'couponValue',
      'exchangeProductId', 'exchangeProductName', 'exchangeQuantity',
      'status', 'processedBy', 'processedAt', 'createdAt'
    ];

    const data = compensations.map(c => ({
      ...c.toJSON(),
      processedAt: c.processedAt ? c.processedAt.toISOString() : '',
    }));

    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    fs.writeFileSync(filePath, csv, 'utf-8');
    return { count: compensations.length, filePath };
  }

  exportCompensationsToExcel(filePath, status = null) {
    const compensations = this.dataStore.find(
      'compensations',
      c => !status || c.status === status,
      Compensation
    );

    const data = compensations.map(c => ({
      补偿ID: c.id,
      订单号: c.orderNo,
      用户ID: c.userId,
      用户名: c.userName,
      手机号: c.phone,
      商品ID: c.productId,
      商品名称: c.productName,
      缺货数量: c.shortageQuantity,
      补偿类型: this.getCompensationTypeName(c.compensationType),
      退款金额: c.refundAmount || '',
      优惠券ID: c.couponId || '',
      优惠券面值: c.couponValue || '',
      换货商品ID: c.exchangeProductId || '',
      换货商品名称: c.exchangeProductName || '',
      换货数量: c.exchangeQuantity || '',
      状态: this.getStatusName(c.status),
      处理人: c.processedBy || '',
      处理时间: c.processedAt ? c.processedAt.toISOString() : '',
      创建时间: c.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '补偿记录');
    XLSX.writeFile(workbook, filePath);
    return { count: compensations.length, filePath };
  }

  exportBadRecordsToCSV(filePath, status = null) {
    const badRecords = this.dataStore.find(
      'badRecords',
      b => !status || b.status === status,
      BadRecord
    );

    const fields = [
      'id', 'sourceType', 'sourceFile', 'rowNumber',
      'errorType', 'errorMessage', 'suggestion',
      'fieldName', 'fieldValue', 'status',
      'resolvedBy', 'resolvedAt', 'resolutionNote', 'createdAt'
    ];

    const data = badRecords.map(b => ({
      ...b.toJSON(),
      resolvedAt: b.resolvedAt ? b.resolvedAt.toISOString() : '',
    }));

    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    fs.writeFileSync(filePath, csv, 'utf-8');
    return { count: badRecords.length, filePath };
  }

  exportBadRecordsToExcel(filePath, status = null) {
    const badRecords = this.dataStore.find(
      'badRecords',
      b => !status || b.status === status,
      BadRecord
    );

    const data = badRecords.map(b => ({
      记录ID: b.id,
      来源类型: this.getSourceTypeName(b.sourceType),
      来源文件: b.sourceFile,
      行号: b.rowNumber,
      错误类型: b.errorType,
      错误信息: b.errorMessage,
      修改建议: b.suggestion,
      字段名: b.fieldName || '',
      字段值: b.fieldValue || '',
      状态: b.status === 'unresolved' ? '未处理' : '已处理',
      处理人: b.resolvedBy || '',
      处理时间: b.resolvedAt ? b.resolvedAt.toISOString() : '',
      处理备注: b.resolutionNote || '',
      创建时间: b.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '问题记录');
    XLSX.writeFile(workbook, filePath);
    return { count: badRecords.length, filePath };
  }

  exportReconciliationReport(filePath) {
    const compensations = this.dataStore.findAll('compensations', Compensation);
    const shortages = this.dataStore.findAll('shortages', Shortage);
    
    const workbook = XLSX.utils.book_new();

    const shortageData = shortages.map(s => ({
      商品ID: s.productId,
      商品名称: s.productName,
      缺货日期: s.shortageDate,
      预期数量: s.expectedQuantity,
      实际数量: s.actualQuantity,
      缺货数量: s.shortageQuantity,
      供应商: s.supplierName,
      原因: s.reason,
    }));
    const shortageSheet = XLSX.utils.json_to_sheet(shortageData);
    XLSX.utils.book_append_sheet(workbook, shortageSheet, '缺货清单');

    const compensationData = compensations.map(c => ({
      订单号: c.orderNo,
      用户: c.userName,
      手机号: c.phone,
      商品: c.productName,
      缺货数量: c.shortageQuantity,
      补偿类型: this.getCompensationTypeName(c.compensationType),
      退款金额: c.refundAmount || '',
      优惠券面值: c.couponValue || '',
      换货商品: c.exchangeProductName || '',
      状态: this.getStatusName(c.status),
    }));
    const compensationSheet = XLSX.utils.json_to_sheet(compensationData);
    XLSX.utils.book_append_sheet(workbook, compensationSheet, '补偿记录');

    const summary = this.generateCompensationSummary();
    const summaryData = [
      { 项目: '总补偿订单数', 数值: summary.total },
      { 项目: '退款订单数', 数值: summary.byType.refund },
      { 项目: '优惠券订单数', 数值: summary.byType.coupon },
      { 项目: '换货订单数', 数值: summary.byType.exchange },
      { 项目: '待审核', 数值: summary.byStatus.pending },
      { 项目: '已审核', 数值: summary.byStatus.approved },
      { 项目: '已执行', 数值: summary.byStatus.executed },
      { 项目: '总退款金额', 数值: summary.totalRefundAmount.toFixed(2) },
      { 项目: '总优惠券金额', 数值: summary.totalCouponValue.toFixed(2) },
      { 项目: '总换货数量', 数值: summary.totalExchangeItems },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '统计汇总');

    XLSX.writeFile(workbook, filePath);
    return { filePath };
  }

  getCompensationTypeName(type) {
    const names = {
      refund: '退款',
      coupon: '优惠券',
      exchange: '换货',
    };
    return names[type] || type;
  }

  getStatusName(status) {
    const names = {
      pending: '待审核',
      approved: '已审核',
      executed: '已执行',
      failed: '失败',
    };
    return names[status] || status;
  }

  getSourceTypeName(type) {
    const names = {
      order: '订单数据',
      shortage: '缺货数据',
      rule: '规则数据',
    };
    return names[type] || type;
  }
}

module.exports = ReportService;
