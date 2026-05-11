const chalk = require('chalk');
const { table } = require('table');

function formatCurrency(amount) {
  const sign = amount >= 0 ? '' : '-';
  return `${sign}¥${Math.abs(amount).toFixed(2)}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

function formatConsoleReport(result) {
  const lines = [];
  
  lines.push('');
  lines.push(chalk.bold.cyan('══════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('           门店现金长短款核对报告'));
  lines.push(chalk.bold.cyan('══════════════════════════════════════════════════'));
  lines.push('');
  
  lines.push(chalk.bold('📅 日期: ') + result.date);
  lines.push(chalk.bold('🏪 门店: ') + result.storeId);
  lines.push(chalk.bold('⏰ 生成时间: ') + formatDate(result.generatedAt));
  lines.push('');

  const { summary } = result;
  let statusText = '';
  let statusColor = chalk.green;
  
  switch (summary.status) {
    case 'shortage':
      statusText = '🔴 短款';
      statusColor = chalk.red;
      break;
    case 'overage':
      statusText = '🟢 长款';
      statusColor = chalk.green;
      break;
    case 'warning':
      statusText = '🟡 异常';
      statusColor = chalk.yellow;
      break;
    default:
      statusText = '✅ 正常';
      statusColor = chalk.green;
  }

  lines.push(chalk.bold('📊 日结状态: ') + statusColor.bold(statusText));
  lines.push('');

  const summaryTable = [
    [chalk.bold('项目'), chalk.bold('金额')],
    ['现金交易总额', formatCurrency(summary.totalCashTransactions)],
    ['退款总额', formatCurrency(summary.totalRefunds)],
    ['备用金变动', formatCurrency(summary.totalPettyCash)],
    [chalk.bold('应收现金'), chalk.bold(formatCurrency(summary.totalExpected))],
    [chalk.bold('实缴现金'), chalk.bold(formatCurrency(summary.totalActual))],
    [chalk.bold('差异金额'), summary.totalDifference >= 0 ? chalk.green.bold(formatCurrency(summary.totalDifference)) : chalk.red.bold(formatCurrency(summary.totalDifference))]
  ];

  lines.push(table(summaryTable, {
    columns: {
      0: { width: 15 },
      1: { width: 15, alignment: 'right' }
    },
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  }));

  if (summary.cashiersWithDiscrepancy > 0) {
    lines.push(chalk.yellow(`⚠️  有 ${summary.cashiersWithDiscrepancy} 位收银员存在差异`));
    lines.push('');
  }

  result.cashiers.forEach(cashier => {
    lines.push(chalk.bold.magenta(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    lines.push(chalk.bold.magenta(`👤 收银员: ${cashier.cashierId}`));
    lines.push(chalk.bold.magenta(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    
    const cashierTable = [
      [chalk.bold('项目'), chalk.bold('金额')],
      ['现金交易', formatCurrency(cashier.cashTransactions)],
      ['退款金额', formatCurrency(cashier.refundAmount)],
      ['备用金变动', formatCurrency(cashier.pettyCashChanges)],
      [chalk.bold('应收现金'), chalk.bold(formatCurrency(cashier.expectedCash))],
      [chalk.bold('实缴现金'), chalk.bold(formatCurrency(cashier.actualCash))],
      [chalk.bold('差异'), cashier.difference >= 0 ? chalk.green.bold(formatCurrency(cashier.difference)) : chalk.red.bold(formatCurrency(cashier.difference))]
    ];

    lines.push(table(cashierTable, {
      columns: {
        0: { width: 12 },
        1: { width: 15, alignment: 'right' }
      }
    }));

    if (cashier.possibleCauses.length > 0) {
      lines.push(chalk.bold('🔍 可能原因:'));
      cashier.possibleCauses.forEach((cause, index) => {
        lines.push(`   ${index + 1}. ${cause}`);
      });
    }

    if (cashier.pendingConfirmations.length > 0) {
      lines.push('');
      lines.push(chalk.bold('📋 待确认事项:'));
      cashier.pendingConfirmations.forEach((item, index) => {
        lines.push(`   ${index + 1}. ${item}`);
      });
    }
  });

  if (result.anomalies.length > 0) {
    lines.push('');
    lines.push(chalk.bold.red('⚠️  异常检测结果:'));
    lines.push('');
    
    result.anomalies.forEach((anomaly, index) => {
      let icon = '';
      let color = chalk.yellow;
      
      switch (anomaly.severity) {
        case 'high':
          icon = '🔴';
          color = chalk.red;
          break;
        case 'medium':
          icon = '🟡';
          color = chalk.yellow;
          break;
        default:
          icon = '🟢';
          color = chalk.green;
      }
      
      lines.push(color(`   ${icon} [${index + 1}] ${anomaly.message}`));
      lines.push(color(`      类型: ${anomaly.type}`));
    });
  }

  if (result.investigationNotes && result.investigationNotes.length > 0) {
    lines.push('');
    lines.push(chalk.bold.blue('📝 调查备注:'));
    lines.push('');
    
    result.investigationNotes.forEach((note, index) => {
      lines.push(chalk.blue(`   [${index + 1}] 收银员 ${note.cashierId}: ${note.note}`));
      lines.push(chalk.gray(`       ${formatDate(note.timestamp)}`));
    });
  }

  lines.push('');
  lines.push(chalk.cyan('══════════════════════════════════════════════════'));
  lines.push(chalk.cyan('              报告生成完毕'));
  lines.push(chalk.cyan('══════════════════════════════════════════════════'));
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  formatConsoleReport,
  formatCurrency,
  formatDate
};
