const chalk = require('chalk');

function formatMoney(amount) {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function printHeader(title) {
  console.log('\n' + chalk.bold.cyan('='.repeat(60)));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan('='.repeat(60)) + '\n');
}

function printSummary(summary) {
  const { totals, importedFiles } = summary;

  printHeader('月结汇总');

  console.log(chalk.bold('【导入记录】'));
  if (importedFiles.length === 0) {
    console.log('  (尚未导入任何文件)');
  } else {
    importedFiles.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f}`);
    });
  }
  console.log('');

  console.log(chalk.bold('【数据统计】'));
  console.log(`  订单数: ${totals.orderCount}`);
  console.log(`  收款数: ${totals.paymentCount}`);
  console.log(`  发票数: ${totals.invoiceCount}`);
  console.log('');

  console.log(chalk.bold('【金额汇总】'));
  console.log(`  订单总金额:     ${chalk.white(formatMoney(totals.orderAmount))}`);
  console.log(`  收款总金额:     ${chalk.green(formatMoney(totals.paymentAmount))}`);
  console.log(`  已开票金额:     ${chalk.blue(formatMoney(totals.invoiceAmount))}`);
  console.log(`  红冲金额:       ${chalk.magenta(formatMoney(totals.redInvoiceAmount))}`);
  console.log(`  净开票金额:     ${chalk.cyan(formatMoney(totals.netInvoiceAmount))}`);
  console.log(`  ${chalk.bold('未开票缺口:')}     ${chalk.red.bold(formatMoney(totals.unopenedAmount))}`);
  console.log('');

  console.log(chalk.bold('【问题检测】'));
  if (totals.issueCount === 0) {
    console.log(chalk.green('  ✓ 未发现数据问题'));
  } else {
    console.log(chalk.red(`  ✗ 发现 ${totals.issueCount} 个问题`));
    console.log(chalk.red(`  ✗ 涉及 ${totals.customersWithIssues} 个客户`));
  }
  console.log('');
}

function printCustomerList(customers) {
  printHeader('客户列表');

  console.log(chalk.bold(
    `${'客户'.padEnd(20)} ${'订单数'.padEnd(8)} ${'收款金额'.padEnd(15)} ${'净开票'.padEnd(15)} ${'未开票'.padEnd(15)} ${'状态'}`
  ));
  console.log('-'.repeat(85));

  for (const c of customers) {
    const status = c.hasIssue ? chalk.red('有问题') : chalk.green('正常');
    console.log(
      `${(c.customer || '未知客户').slice(0, 18).padEnd(20)} ` +
      `${String(c.orderCount).padEnd(8)} ` +
      `${formatMoney(c.paymentAmount).padEnd(15)} ` +
      `${formatMoney(c.netInvoiceAmount).padEnd(15)} ` +
      `${formatMoney(c.unopenedAmount).padEnd(15)} ` +
      status
    );
  }
  console.log('');
}

function printCustomerDetail(detail) {
  if (!detail) {
    console.log(chalk.red('未找到该客户'));
    return;
  }

  const { customer, orders, customerIssues } = detail;

  printHeader(`客户详情: ${customer.customer}`);

  console.log(chalk.bold('【客户汇总】'));
  console.log(`  订单数:         ${customer.orderCount}`);
  console.log(`  订单总金额:     ${formatMoney(customer.orderAmount)}`);
  console.log(`  收款总金额:     ${formatMoney(customer.paymentAmount)}`);
  console.log(`  已开票金额:     ${formatMoney(customer.invoiceAmount)}`);
  console.log(`  红冲金额:       ${formatMoney(customer.redInvoiceAmount)}`);
  console.log(`  净开票金额:     ${formatMoney(customer.netInvoiceAmount)}`);
  console.log(`  ${chalk.bold('未开票缺口:')}     ${chalk.red.bold(formatMoney(customer.unopenedAmount))}`);
  console.log('');

  console.log(chalk.bold('【订单明细】'));
  console.log(chalk.bold(
    `${'订单号'.padEnd(15)} ${'日期'.padEnd(12)} ${'订单金额'.padEnd(12)} ${'收款'.padEnd(12)} ${'开票'.padEnd(12)} ${'红冲'.padEnd(12)} ${'未开票'.padEnd(12)} ${'状态'}`
  ));
  console.log('-'.repeat(100));

  for (const order of orders) {
    const status = order.hasIssue ? chalk.red('有问题') : chalk.green('正常');
    console.log(
      `${order.orderId.slice(0, 13).padEnd(15)} ` +
      `${(order.orderDate || '').slice(0, 10).padEnd(12)} ` +
      `${formatMoney(order.orderAmount).padEnd(12)} ` +
      `${formatMoney(order.paymentAmount).padEnd(12)} ` +
      `${formatMoney(order.invoiceAmount).padEnd(12)} ` +
      `${formatMoney(order.redInvoiceAmount).padEnd(12)} ` +
      `${formatMoney(order.unopenedAmount).padEnd(12)} ` +
      status
    );
  }
  console.log('');

  if (customerIssues.length > 0) {
    console.log(chalk.bold('【该客户存在的问题】'));
    for (const issue of customerIssues) {
      const severityColor = issue.severity === 'high' ? chalk.red : chalk.yellow;
      console.log(`  ${severityColor('●')} [${issue.category}] ${issue.message}`);
    }
    console.log('');
  }
}

function printIssues(issues, notes = {}) {
  printHeader('问题清单');

  if (issues.length === 0) {
    console.log(chalk.green('  ✓ 未发现任何数据问题'));
    console.log('');
    return;
  }

  issues.forEach((issue, index) => {
    const severityColor = issue.severity === 'high' ? chalk.red : chalk.yellow;
    const severityLabel = issue.severity === 'high' ? '高' : '中';
    
    console.log(`${index + 1}. ${severityColor(`[${severityLabel}]`)} [${issue.category}] ${issue.type}`);
    console.log(`   ${issue.message}`);
    console.log(`   问题标识: ${chalk.gray(issue.key)}`);
    
    const note = notes[issue.key];
    if (note) {
      console.log(`   ${chalk.cyan('人工说明:')} ${note.text}`);
      console.log(`   ${chalk.gray(`(${new Date(note.createdAt).toLocaleString()})`)}`);
    }
    console.log('');
  });
}

function printImportResult(result) {
  if (result.skipped) {
    console.log(chalk.yellow(`⚠ ${result.message}`));
    console.log(chalk.gray('  (同一文件不会重复导入，避免金额翻倍)'));
  } else if (result.success) {
    console.log(chalk.green(`✓ ${result.message}`));
  } else {
    console.log(chalk.red(`✗ ${result.message}`));
  }
}

function printExportResults(results) {
  printHeader('导出完成');
  results.forEach(r => {
    console.log(`  ✓ ${r.type}: ${r.path}`);
  });
  console.log('');
}

module.exports = {
  formatMoney,
  printHeader,
  printSummary,
  printCustomerList,
  printCustomerDetail,
  printIssues,
  printImportResult,
  printExportResults
};
