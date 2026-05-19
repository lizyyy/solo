const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Order = require('../models/Order');
const ProcessingResult = require('../models/ProcessingResult');
const ImportError = require('../models/ImportError');

class Exporter {
  static async exportReportToCSV(filePath) {
    const results = await ProcessingResult.findAll();
    const compensationTypes = {
      refund: '退款',
      exchange: '换货',
      coupon: '补券'
    };

    const rows = results.map(r => ({
      订单号: r.order_no,
      补偿类型: compensationTypes[r.compensation_type] || r.compensation_type,
      补偿金额: r.compensation_value || 0,
      处理状态: r.status,
      备注: r.notes || '',
      处理时间: r.processed_at
    }));

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
    return { count: rows.length };
  }

  static async exportReportToExcel(filePath) {
    const results = await ProcessingResult.findAll();
    const compensationTypes = {
      refund: '退款',
      exchange: '换货',
      coupon: '补券'
    };

    const rows = results.map(r => ({
      '订单号': r.order_no,
      '补偿类型': compensationTypes[r.compensation_type] || r.compensation_type,
      '补偿金额': r.compensation_value || 0,
      '处理状态': r.status,
      '备注': r.notes || '',
      '处理时间': r.processed_at
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '补偿报告');
    XLSX.writeFile(wb, filePath);

    return { count: rows.length };
  }

  static async exportErrorsToCSV(filePath) {
    const errors = await ImportError.findAll();
    const importTypes = {
      order: '订单',
      out_of_stock: '缺货清单',
      compensation_rule: '补偿规则'
    };

    const rows = errors.map(e => ({
      导入类型: importTypes[e.import_type] || e.import_type,
      文件名: e.file_name,
      行号: e.row_number,
      错误信息: e.error_message,
      修改建议: e.suggestion || '',
      记录时间: e.created_at
    }));

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
    return { count: rows.length };
  }

  static async exportOrdersToCSV(filePath) {
    const orders = await Order.findAll();
    const statusMap = {
      pending: '待处理',
      processed: '已处理',
      refunded: '已退款',
      exchanged: '已换货',
      couponed: '已补券'
    };

    const rows = orders.map(o => ({
      订单号: o.order_no,
      用户ID: o.user_id,
      用户姓名: o.user_name,
      联系电话: o.phone || '',
      商品ID: o.product_id,
      商品名称: o.product_name,
      数量: o.quantity,
      单价: o.price,
      总金额: o.total_amount,
      状态: statusMap[o.status] || o.status,
      创建时间: o.created_at
    }));

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
    return { count: rows.length };
  }

  static async getSummary() {
    const orders = await Order.findAll();
    const results = await ProcessingResult.findAll();
    const errors = await ImportError.findAll();

    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    const compensationStats = results.reduce((acc, r) => {
      if (!acc[r.compensation_type]) {
        acc[r.compensation_type] = { count: 0, total: 0 };
      }
      acc[r.compensation_type].count++;
      acc[r.compensation_type].total += r.compensation_value || 0;
      return acc;
    }, {});

    return {
      totalOrders: orders.length,
      totalProcessed: results.length,
      totalErrors: errors.length,
      statusCounts,
      compensationStats
    };
  }
}

module.exports = Exporter;
