const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Parser } = require('json2csv');
const { getOrders, getAllOrdersWithActions, getStatistics } = require('../db');

const exportCommand = async (outputPath, options) => {
  const filters = {};

  if (options.handler) filters.handler = options.handler;
  if (options.status) filters.status = options.status;
  if (options.exceptionType) filters.exceptionType = options.exceptionType;
  if (options.startDate) filters.startDate = options.startDate;
  if (options.endDate) filters.endDate = options.endDate;

  console.log(chalk.blue(`正在导出数据...`));
  console.log(chalk.gray('='.repeat(50)));

  const orders = options.withActions ? await getAllOrdersWithActions() : await getOrders(filters);

  if (orders.length === 0) {
    console.log(chalk.yellow('没有数据可导出'));
    return;
  }

  const ext = path.extname(outputPath).toLowerCase();
  let exportPath = outputPath;

  if (!ext) {
    exportPath = `${outputPath}.csv`;
  }

  try {
    if (exportPath.endsWith('.json')) {
      exportToJSON(orders, exportPath);
    } else {
      exportToCSV(orders, exportPath, options.withActions);
    }

    console.log(chalk.green(`成功导出 ${orders.length} 条记录`));
    console.log(chalk.blue(`文件路径: ${path.resolve(exportPath)}`));
    console.log(chalk.gray('='.repeat(50)));
  } catch (error) {
    console.error(chalk.red(`导出失败: ${error.message}`));
  }
};

const exportToCSV = (orders, filePath, withActions) => {
  const fields = [
    'order_no',
    'customer_name',
    'phone',
    'product_name',
    'original_amount',
    'handler',
    'status',
    'exception_type',
    'created_at',
    'updated_at'
  ];

  if (withActions) {
    fields.push('action_count', 'action_summary');
    orders = orders.map(order => ({
      ...order,
      action_count: order.actions.length,
      action_summary: order.actions.map(a => `${a.action_type}:${a.amount || a.coupon_code || a.exchange_product}`).join('; ')
    }));
  }

  const json2csvParser = new Parser({ fields, withBOM: true });
  const csv = json2csvParser.parse(orders);
  fs.writeFileSync(filePath, csv, 'utf8');
};

const exportToJSON = (orders, filePath) => {
  const data = JSON.stringify(orders, null, 2);
  fs.writeFileSync(filePath, data, 'utf8');
};

const reportCommand = async (outputPath, options) => {
  console.log(chalk.blue('生成对账报告...'));
  console.log(chalk.gray('='.repeat(50)));

  const stats = await getStatistics();
  const orders = await getAllOrdersWithActions();

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.original_amount, 0),
      byStatus: stats
    },
    filters: {
      handler: options.handler || null,
      status: options.status || null,
      exceptionType: options.exceptionType || null,
      dateRange: options.startDate || options.endDate ? { start: options.startDate, end: options.endDate } : null
    },
    orders: orders
  };

  if (!outputPath) {
    outputPath = `reconcile-report-${new Date().toISOString().split('T')[0]}`;
  }

  const ext = path.extname(outputPath).toLowerCase();
  if (!ext) {
    outputPath = `${outputPath}.json`;
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(chalk.green(`报告已生成: ${path.resolve(outputPath)}`));
  console.log(chalk.blue(`总计: ${report.summary.totalOrders} 条订单`));
  console.log(chalk.blue(`总金额: ¥${report.summary.totalAmount.toFixed(2)}`));
  console.log(chalk.gray('='.repeat(50)));
};

module.exports = { exportCommand, reportCommand };
