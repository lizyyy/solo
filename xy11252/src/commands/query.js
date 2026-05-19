const chalk = require('chalk');
const Table = require('cli-table3');
const { getOrders, getStatistics, getOrderActions, getOrderByNo } = require('../db');

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

const formatStatus = (status) => {
  const statusMap = {
    'pending': chalk.yellow('待处理'),
    'reviewed': chalk.blue('已复核'),
    'completed': chalk.green('已完成'),
    'exception': chalk.red('异常')
  };
  return statusMap[status] || status;
};

const queryCommand = async (options) => {
  const filters = {};

  if (options.handler) filters.handler = options.handler;
  if (options.status) filters.status = options.status;
  if (options.exceptionType) filters.exceptionType = options.exceptionType;
  if (options.startDate) filters.startDate = options.startDate;
  if (options.endDate) filters.endDate = options.endDate;

  const orders = await getOrders(filters);

  if (options.stats) {
    await showStatistics();
    return;
  }

  if (options.detail && orders.length === 1) {
    await showOrderDetail(orders[0]);
    return;
  }

  console.log(chalk.blue(`查询结果: 共 ${orders.length} 条记录`));
  
  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  if (filterDesc) {
    console.log(chalk.gray(`筛选条件: ${filterDesc}`));
  }
  console.log(chalk.gray('='.repeat(100)));

  if (orders.length === 0) {
    console.log(chalk.yellow('没有找到匹配的记录'));
    return;
  }

  const table = new Table({
    head: ['订单号', '客户', '商品', '金额', '负责人', '状态', '异常类型', '创建时间'],
    colWidths: [15, 12, 15, 10, 10, 10, 14, 22]
  });

  orders.forEach(order => {
    table.push([
      order.order_no,
      order.customer_name,
      order.product_name.length > 10 ? order.product_name.substr(0, 8) + '...' : order.product_name,
      `¥${order.original_amount.toFixed(2)}`,
      order.handler || '-',
      formatStatus(order.status),
      order.exception_type || '-',
      formatDate(order.created_at)
    ]);
  });

  console.log(table.toString());

  const totalAmount = orders.reduce((sum, o) => sum + o.original_amount, 0);
  console.log(chalk.gray('='.repeat(100)));
  console.log(chalk.green(`总计: ${orders.length} 条订单，总金额 ¥${totalAmount.toFixed(2)}`));
};

const showStatistics = async () => {
  console.log(chalk.blue('统计摘要'));
  console.log(chalk.gray('='.repeat(50)));

  const stats = await getStatistics();
  
  const table = new Table({
    head: ['状态', '数量', '总金额'],
    colWidths: [15, 10, 15]
  });

  let totalCount = 0;
  let totalAmount = 0;

  stats.forEach(stat => {
    table.push([
      formatStatus(stat.status),
      stat.count,
      `¥${(stat.total_amount || 0).toFixed(2)}`
    ]);
    totalCount += stat.count;
    totalAmount += stat.total_amount || 0;
  });

  table.push([
    chalk.bold('合计'),
    chalk.bold(totalCount),
    chalk.bold(`¥${totalAmount.toFixed(2)}`)
  ]);

  console.log(table.toString());
  console.log(chalk.gray('='.repeat(50)));
};

const showOrderDetail = async (order) => {
  console.log(chalk.blue(`订单详情: ${order.order_no}`));
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
    ['当前状态', formatStatus(order.status)],
    ['异常类型', order.exception_type || '-'],
    ['创建时间', formatDate(order.created_at)],
    ['更新时间', formatDate(order.updated_at)]
  );

  console.log(table.toString());

  const actions = await getOrderActions(order.id);
  if (actions.length > 0) {
    console.log();
    console.log(chalk.blue('操作记录:'));
    const actionTable = new Table({
      head: ['操作类型', '金额/内容', '备注', '时间'],
      colWidths: [12, 25, 12, 20]
    });

    actions.forEach(action => {
      let content = '';
      switch (action.action_type) {
        case 'refund':
          content = `退款 ¥${action.amount.toFixed(2)}`;
          break;
        case 'exchange':
          content = `换货: ${action.exchange_product}`;
          break;
        case 'coupon':
          content = `补券: ${action.coupon_code}`;
          break;
        default:
          content = action.action_type;
      }
      actionTable.push([
        action.action_type,
        content,
        action.notes || '-',
        formatDate(action.created_at)
      ]);
    });

    console.log(actionTable.toString());
  }

  console.log(chalk.gray('='.repeat(60)));
};

const detailCommand = async (orderNo) => {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    console.error(chalk.red(`订单 ${orderNo} 不存在`));
    return;
  }
  await showOrderDetail(order);
};

module.exports = { queryCommand, detailCommand, showStatistics };
