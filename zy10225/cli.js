const chalk = require('chalk');
const Table = require('cli-table3');
const { formatCurrency, formatDate } = require('./utils');

function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

function printError(message) {
  console.error(chalk.red(`✗ ${message}`));
}

function printWarning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

function printInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`));
}

function printHeader(title) {
  console.log('\n' + chalk.bold.white.bgBlue(` ${title} `) + '\n');
}

function printValidationResult(result) {
  console.log('\n' + chalk.bold('校验结果:'));
  console.log(`  总问题数: ${result.total}`);
  console.log(`  ${chalk.red(`错误: ${result.errors}`)}`);
  console.log(`  ${chalk.yellow(`警告: ${result.warnings}`)}`);
  console.log(`  ${chalk.blue(`提示: ${result.infos}`)}`);
  
  if (result.isValid) {
    printSuccess('数据校验通过！');
  } else {
    printError('存在错误，请修复后重试');
  }
  
  if (result.issues && result.issues.length > 0) {
    console.log('\n' + chalk.bold('问题明细:'));
    
    for (const issue of result.issues) {
      let color = chalk.white;
      if (issue.severity === 'error') color = chalk.red;
      else if (issue.severity === 'warning') color = chalk.yellow;
      else color = chalk.blue;
      
      console.log(color(`  [${issue.severity.toUpperCase()}] ${issue.entityType}: ${issue.message}`));
    }
  }
  
  return result.isValid;
}

function printSettlementPreview(result) {
  const { settlement, items, summary } = result;
  
  printHeader('结算预览');
  
  console.log(chalk.bold('结算信息:'));
  console.log(`  结算日期: ${settlement.settlement_date}`);
  console.log(`  周期: ${settlement.period_start} 至 ${settlement.period_end}`);
  console.log(`  状态: ${settlement.status}`);
  console.log('');
  
  const table = new Table({
    head: [
      chalk.bold('摊主'),
      chalk.bold('摊位'),
      chalk.bold('销售额'),
      chalk.bold('退款'),
      chalk.bold('净销售'),
      chalk.bold('抽成'),
      chalk.bold('押金'),
      chalk.bold('电费'),
      chalk.bold('已付'),
      chalk.bold('应付')
    ],
    colWidths: [20, 10, 12, 10, 12, 10, 10, 10, 10, 12]
  });
  
  for (const item of items) {
    const amountDueColor = item.amount_due < 0 ? chalk.red : chalk.green;
    table.push([
      item.vendor_name,
      item.booths && item.booths.length > 0 ? item.booths.map(b => b.booth_id).join(',') : '-',
      formatCurrency(item.total_sales),
      formatCurrency(item.total_refunds),
      formatCurrency(item.net_sales),
      formatCurrency(item.commission_amount),
      formatCurrency(item.deposit_amount),
      formatCurrency(item.electricity_fee),
      formatCurrency(item.previous_payments),
      amountDueColor(formatCurrency(item.amount_due))
    ]);
  }
  
  console.log(table.toString());
  
  console.log('\n' + chalk.bold('汇总:'));
  const summaryTable = new Table({
    head: [
      chalk.bold('摊主数'),
      chalk.bold('总销售额'),
      chalk.bold('总退款'),
      chalk.bold('总抽成'),
      chalk.bold('总应付')
    ]
  });
  
  const totalDueColor = summary.total_due < 0 ? chalk.red : chalk.green;
  summaryTable.push([
    summary.total_vendors,
    formatCurrency(summary.total_sales),
    formatCurrency(summary.total_refunds),
    formatCurrency(summary.total_commission),
    totalDueColor(formatCurrency(summary.total_due))
  ]);
  
  console.log(summaryTable.toString());
  
  console.log('\n' + chalk.cyan('提示: 确认无误后，请使用 confirm 命令确认结算'));
}

function printSettlementDetail(detail) {
  const { settlement, items, summary } = detail;
  
  printHeader(`结算详情 (${settlement.status})`);
  
  console.log(`  ID: ${settlement.id}`);
  console.log(`  结算日期: ${settlement.settlement_date}`);
  console.log(`  周期: ${settlement.period_start} 至 ${settlement.period_end}`);
  console.log(`  状态: ${settlement.status}`);
  console.log(`  创建时间: ${settlement.created_at}`);
  console.log('');
  
  for (const item of items) {
    console.log(chalk.bold(`\n摊主: ${item.vendor_name}`));
    
    let boothDisplay = '';
    if (item.booths && item.booths.length > 0) {
      const boothIds = item.booths.map(b => b.booth_id).join(', ');
      boothDisplay = item.booths.length > 1 ? `${boothIds} (多个摊位)` : boothIds;
    } else {
      boothDisplay = item.booth_number || '-';
    }
    console.log(`  摊位: ${boothDisplay}`);
    
    if (item.booths && item.booths.length > 0) {
      console.log(`  摊位明细:`);
      for (const booth of item.booths) {
        let rateStr = '';
        if (booth.commission_rate) {
          if (booth.commission_rate.rate_type === 'flat') {
            rateStr = `固定${(booth.commission_rate.flat_rate * 100).toFixed(1)}%`;
          } else {
            rateStr = '阶梯抽成';
          }
        }
        console.log(`    ${booth.booth_id}: 销售额${formatCurrency(booth.total_sales)}, 退款${formatCurrency(booth.total_refunds)}, 抽成${formatCurrency(booth.commission_amount || 0)} (${rateStr})`);
      }
    }
    
    console.log(`  总销售额: ${formatCurrency(item.total_sales)}`);
    console.log(`  退款: ${formatCurrency(item.total_refunds)}`);
    console.log(`  净销售: ${formatCurrency(item.net_sales)}`);
    console.log(`  抽成: ${formatCurrency(item.commission_amount)}`);
    console.log(`  押金: ${formatCurrency(item.deposit_amount)}`);
    console.log(`  电费: ${formatCurrency(item.electricity_fee)}`);
    console.log(`  已付款: ${formatCurrency(item.previous_payments)}`);
    console.log(chalk.bold(`  应付: ${formatCurrency(item.amount_due)}`));
    
    if (item.settlement_refunds && item.settlement_refunds.length > 0) {
      console.log(chalk.magenta(`  退款明细 (${item.settlement_refunds.length} 条):`));
      for (const sr of item.settlement_refunds) {
        const historicalLabel = sr.is_historical ? ' [历史退款]' : '';
        console.log(`    [${sr.refund_date}] ${formatCurrency(sr.refund_amount)}${historicalLabel}`);
        if (sr.reason) console.log(`      原因: ${sr.reason}`);
      }
    }
    
    if (item.adjustments && item.adjustments.length > 0) {
      console.log(chalk.yellow(`  调整记录 (${item.adjustments.length} 条):`));
      for (const adj of item.adjustments) {
        console.log(`    - ${adj.adjustment_type}: ${adj.amount > 0 ? '+' : ''}${formatCurrency(adj.amount)}`);
        if (adj.reason) console.log(`      原因: ${adj.reason}`);
        if (adj.note) console.log(`      说明: ${adj.note}`);
      }
    }
    
    if (item.adjustment_note) {
      console.log(chalk.cyan(`  调整说明:\n${item.adjustment_note.split('\n').map(l => '    ' + l).join('\n')}`));
    }
  }
  
  console.log('\n' + chalk.bold('汇总:'));
  console.log(`  摊主数: ${summary.total_vendors}`);
  console.log(`  总销售额: ${formatCurrency(summary.total_sales)}`);
  console.log(`  总退款: ${formatCurrency(summary.total_refunds)}`);
  console.log(`  总抽成: ${formatCurrency(summary.total_commission)}`);
  console.log(`  总应付: ${formatCurrency(summary.total_due)}`);
}

function printSettlementHistory(settlements) {
  if (settlements.length === 0) {
    printInfo('暂无结算记录');
    return;
  }
  
  printHeader('结算历史');
  
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('结算日期'),
      chalk.bold('周期'),
      chalk.bold('状态')
    ],
    colWidths: [40, 15, 30, 15]
  });
  
  for (const s of settlements) {
    let statusColor = chalk.white;
    if (s.status === 'confirmed') statusColor = chalk.green;
    else if (s.status === 'previewed') statusColor = chalk.yellow;
    else statusColor = chalk.gray;
    
    table.push([
      s.id.substring(0, 8) + '...',
      s.settlement_date,
      `${s.period_start} ~ ${s.period_end}`,
      statusColor(s.status)
    ]);
  }
  
  console.log(table.toString());
}

function printImportResult(result, dataType) {
  if (result.alreadyImported) {
    printWarning(`该文件已在 ${result.importLog.created_at} 导入过`);
    printInfo(`共 ${result.importLog.records_count} 条记录，已处理 ${result.importLog.processed_count} 条，跳过 ${result.importLog.skipped_count} 条`);
    return;
  }
  
  printSuccess(`导入 ${dataType} 完成`);
  printInfo(`  总计: ${result.totalRecords} 条`);
  printInfo(`  成功: ${result.processed} 条`);
  printInfo(`  跳过: ${result.skipped} 条`);
  
  if (result.errors && result.errors.length > 0) {
    printWarning(`  错误 (${result.errors.length} 条):`);
    for (const err of result.errors.slice(0, 10)) {
      console.log(chalk.yellow(`    - ${err}`));
    }
    if (result.errors.length > 10) {
      console.log(chalk.yellow(`    ... 还有 ${result.errors.length - 10} 条错误`));
    }
  }
}

module.exports = {
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printHeader,
  printValidationResult,
  printSettlementPreview,
  printSettlementDetail,
  printSettlementHistory,
  printImportResult
};
