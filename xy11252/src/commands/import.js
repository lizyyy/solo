const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const chalk = require('chalk');
const { addOrder, getOrderByNo } = require('../db');

const importFromJSON = async (filePath) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const orders = Array.isArray(data) ? data : [data];
    return processOrders(orders);
  } catch (error) {
    console.error(chalk.red(`JSON解析失败: ${error.message}`));
    return { success: 0, failed: 0, errors: [error.message] };
  }
};

const importFromCSV = (filePath) => {
  return new Promise((resolve) => {
    const orders = [];
    const errors = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        orders.push({
          orderNo: row.orderNo || row.order_no,
          customerName: row.customerName || row.customer_name,
          phone: row.phone,
          productName: row.productName || row.product_name,
          originalAmount: parseFloat(row.originalAmount || row.original_amount || 0),
          handler: row.handler,
          status: row.status || 'pending',
          exceptionType: row.exceptionType || row.exception_type,
          createdAt: row.createdAt || row.created_at
        });
      })
      .on('end', async () => {
        const result = await processOrders(orders);
        resolve(result);
      })
      .on('error', (error) => {
        console.error(chalk.red(`CSV解析失败: ${error.message}`));
        resolve({ success: 0, failed: 0, errors: [error.message] });
      });
  });
};

const processOrders = async (orders) => {
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const order of orders) {
    try {
      if (!order.orderNo) {
        throw new Error(`缺少订单号`);
      }
      if (!order.customerName) {
        throw new Error(`订单${order.orderNo}缺少客户姓名`);
      }
      if (!order.productName) {
        throw new Error(`订单${order.orderNo}缺少商品名称`);
      }
      if (isNaN(order.originalAmount)) {
        throw new Error(`订单${order.orderNo}金额格式错误`);
      }

      const existing = await getOrderByNo(order.orderNo);
      if (existing) {
        throw new Error(`订单${order.orderNo}已存在`);
      }

      await addOrder(order);
      success++;
    } catch (error) {
      failed++;
      errors.push(error.message);
    }
  }

  return { success, failed, errors };
};

const importCommand = async (filePath, options) => {
  const ext = path.extname(filePath).toLowerCase();

  console.log(chalk.blue(`正在导入文件: ${filePath}`));
  console.log(chalk.gray('='.repeat(50)));

  let result;

  if (ext === '.json') {
    result = await importFromJSON(filePath);
  } else if (ext === '.csv') {
    result = await importFromCSV(filePath);
  } else {
    console.error(chalk.red('不支持的文件格式，仅支持 .json 和 .csv'));
    return;
  }

  console.log(chalk.green(`成功导入: ${result.success} 条`));
  if (result.failed > 0) {
    console.log(chalk.yellow(`导入失败: ${result.failed} 条`));
    console.log(chalk.gray('错误详情:'));
    result.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
  }

  console.log(chalk.gray('='.repeat(50)));
};

module.exports = { importCommand, importFromJSON, importFromCSV };
