const chalk = require('chalk');
const Table = require('cli-table3');
const { getOrderByNo, updateOrderStatus, addAction } = require('../db');

const ACTION_TYPES = {
  REFUND: 'refund',
  EXCHANGE: 'exchange',
  COUPON: 'coupon'
};

const STATUS_TYPES = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  COMPLETED: 'completed',
  EXCEPTION: 'exception'
};

const EXCEPTION_TYPES = {
  AMOUNT_MISMATCH: 'amount_mismatch',
  DATA_INCOMPLETE: 'data_incomplete',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  OTHER: 'other'
};

const reviewCommand = async (orderNo, options) => {
  const order = await getOrderByNo(orderNo);

  if (!order) {
    console.error(chalk.red(`订单 ${orderNo} 不存在`));
    return;
  }

  console.log(chalk.blue(`复核订单: ${orderNo}`));
  console.log(chalk.gray('='.repeat(60)));

  const table = new Table({
    head: ['字段', '内容'],
    colWidths: [20, 40]
  });

  table.push(
    ['订单号', order.order_no],
    ['客户姓名', order.customer_name],
    ['联系电话', order.phone || '-'],
    ['商品名称', order.product_name],
    ['原始金额', `¥${order.original_amount.toFixed(2)}`],
    ['负责人', order.handler || '-'],
    ['当前状态', order.status],
    ['异常类型', order.exception_type || '-'],
    ['创建时间', order.created_at]
  );

  console.log(table.toString());
  console.log();

  if (options.status) {
    if (!Object.values(STATUS_TYPES).includes(options.status)) {
      console.error(chalk.red(`无效的状态类型。支持的状态: ${Object.values(STATUS_TYPES).join(', ')}`));
      return;
    }
    await updateOrderStatus(orderNo, options.status, options.exceptionType);
    console.log(chalk.green(`状态已更新为: ${options.status}`));
  }

  if (options.action) {
    const actionType = options.action.toLowerCase();
    
    if (!Object.values(ACTION_TYPES).includes(actionType)) {
      console.error(chalk.red(`无效的操作类型。支持的操作: ${Object.values(ACTION_TYPES).join(', ')}`));
      return;
    }

    const action = {
      orderId: order.id,
      actionType: actionType,
      notes: options.notes || ''
    };

    switch (actionType) {
      case ACTION_TYPES.REFUND:
        if (options.amount === undefined) {
          console.error(chalk.red('退款操作需要指定 --amount 参数'));
          return;
        }
        action.amount = parseFloat(options.amount);
        console.log(chalk.green(`处理退款: ¥${action.amount.toFixed(2)}`));
        break;

      case ACTION_TYPES.EXCHANGE:
        if (!options.product) {
          console.error(chalk.red('换货操作需要指定 --product 参数'));
          return;
        }
        action.exchangeProduct = options.product;
        action.exchangeAmount = parseFloat(options.exchangeAmount || order.original_amount);
        console.log(chalk.green(`处理换货: ${order.product_name} -> ${action.exchangeProduct}`));
        break;

      case ACTION_TYPES.COUPON:
        if (!options.coupon) {
          console.error(chalk.red('补券操作需要指定 --coupon 参数'));
          return;
        }
        action.couponCode = options.coupon;
        action.amount = parseFloat(options.amount || order.original_amount);
        console.log(chalk.green(`处理补券: ${action.couponCode} (¥${action.amount.toFixed(2)})`));
        break;
    }

    await addAction(action);
    await updateOrderStatus(orderNo, STATUS_TYPES.REVIEWED, options.exceptionType);
    console.log(chalk.green('操作记录已保存'));
  }

  if (options.exceptionType) {
    if (!Object.values(EXCEPTION_TYPES).includes(options.exceptionType)) {
      console.error(chalk.yellow(`提示: 建议使用标准异常类型 - ${Object.values(EXCEPTION_TYPES).join(', ')}`));
    }
    await updateOrderStatus(orderNo, order.status, options.exceptionType);
    console.log(chalk.green(`异常类型已更新为: ${options.exceptionType}`));
  }

  console.log(chalk.gray('='.repeat(60)));
};

const batchReviewCommand = async (options) => {
  console.log(chalk.blue('批量复核模式'));
  console.log(chalk.gray('='.repeat(60)));
  console.log(chalk.yellow('批量复核功能开发中...'));
  console.log(chalk.gray('='.repeat(60)));
};

module.exports = { 
  reviewCommand, 
  batchReviewCommand, 
  ACTION_TYPES, 
  STATUS_TYPES,
  EXCEPTION_TYPES 
};
