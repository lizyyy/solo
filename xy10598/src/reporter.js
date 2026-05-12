const fs = require('fs-extra');
const path = require('path');
const { table } = require('table');
const chalk = require('chalk');
const { formatMoney } = require('./utils');
const config = require('../config.json');

function generateReport(workDir, period, data, options = {}) {
  const reportDir = path.join(workDir, config.reports.outputDir);
  fs.ensureDirSync(reportDir);

  const timestamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(reportDir, `commission-report-${period}-${timestamp}.txt`);
  
  const content = generateReportContent(period, data);
  
  fs.writeFileSync(reportPath, content, 'utf-8');
  
  if (options.console) {
    console.log(content);
  }

  return {
    path: reportPath,
    period,
    message: `报告已生成: ${reportPath}`
  };
}

function generateReportContent(period, data) {
  const lines = [];
  
  lines.push('═'.repeat(80));
  lines.push('门店导购提成复核报告');
  lines.push(`期间: ${formatPeriod(period)}`);
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('═'.repeat(80));
  lines.push('');

  if (data.checkResult) {
    lines.push('【一、数据检查结果】');
    lines.push('─'.repeat(80));
    
    const { counts, categories, status } = data.checkResult.summary;
    const statusText = {
      'passed': chalk.green('✓ 通过'),
      'needs_review': chalk.yellow('⚠ 需要复核'),
      'failed': chalk.red('✗ 存在错误')
    };
    
    lines.push(`整体状态: ${statusText[status]}`);
    lines.push(`错误: ${counts.error} 条 | 警告: ${counts.warning} 条 | 信息: ${counts.info} 条`);
    lines.push('');
    
    if (data.checkResult.issues && data.checkResult.issues.length > 0) {
      data.checkResult.issues.forEach((issue, idx) => {
        const typeIcon = {
          'error': chalk.red('✗'),
          'warning': chalk.yellow('⚠'),
          'info': chalk.blue('ℹ')
        };
        lines.push(`${typeIcon[issue.type]} [${issue.category}] ${issue.description}`);
        lines.push(`   ${issue.details}`);
        lines.push('');
      });
    } else {
      lines.push('  无问题发现');
      lines.push('');
    }
  }

  if (data.calculationSummary) {
    lines.push('【二、提成计算汇总】');
    lines.push('─'.repeat(80));
    lines.push(`销售提成: ¥${formatMoney(data.calculationSummary.salesCommission)}`);
    lines.push(`退货扣减: ¥${formatMoney(data.calculationSummary.returnDeduction)}`);
    lines.push(`净额提成: ¥${formatMoney(data.calculationSummary.netCommission)}`);
    lines.push(`涉及导购: ${data.calculationSummary.staffCount} 人`);
    lines.push('');
  }

  if (data.staffSummary && data.staffSummary.length > 0) {
    lines.push('【三、导购提成明细汇总】');
    lines.push('─'.repeat(80));
    
    const tableData = [
      ['导购编码', '姓名', '门店', '销售提成', '退货扣减', '净额']
    ];
    
    data.staffSummary.forEach(staff => {
      tableData.push([
        staff.staff_code,
        staff.staff_name || '-',
        staff.store_code || '-',
        `¥${formatMoney(staff.sales_total || staff.sales_commission || 0)}`,
        `¥${formatMoney(staff.return_total || staff.return_deduction || 0)}`,
        chalk.green(`¥${formatMoney(staff.net_total || staff.final_amount || 0)}`)
      ]);
    });
    
    lines.push(table(tableData, {
      border: getBorderStyle()
    }));
  }

  if (data.pendingReview) {
    lines.push('【四、待复核事项】');
    lines.push('─'.repeat(80));
    lines.push(`待复核总数: ${data.pendingReview.totalPending}`);
    lines.push('');
    
    if (data.pendingReview.ordersWithoutAllocation && data.pendingReview.ordersWithoutAllocation.length > 0) {
      lines.push('■ 无导购分摊订单:');
      data.pendingReview.ordersWithoutAllocation.forEach(order => {
        lines.push(`  ${order.order_no} | ${order.order_date} | ¥${formatMoney(order.net_amount)} | ${order.store_code}`);
      });
      lines.push('');
    }
    
    if (data.pendingReview.crossMonthReturns && data.pendingReview.crossMonthReturns.length > 0) {
      lines.push('■ 跨月退货:');
      data.pendingReview.crossMonthReturns.forEach(ret => {
        lines.push(`  ${ret.return_no} → 原单: ${ret.original_order_no} (${ret.original_date}) | ¥${formatMoney(ret.total_amount)}`);
      });
      lines.push('');
    }
  }

  if (data.adjustments && data.adjustments.length > 0) {
    lines.push('【五、人工调整记录】');
    lines.push('─'.repeat(80));
    
    const adjTable = [
      ['调整单号', '导购', '原金额', '调整后', '差额', '原因', '操作人']
    ];
    
    data.adjustments.forEach(adj => {
      const diffColor = adj.difference > 0 ? chalk.green : chalk.red;
      adjTable.push([
        adj.adjustment_no,
        adj.staff_name,
        `¥${formatMoney(adj.original_amount)}`,
        `¥${formatMoney(adj.adjusted_amount)}`,
        diffColor(adj.difference > 0 ? `+¥${formatMoney(adj.difference)}` : `-¥${formatMoney(Math.abs(adj.difference))}`),
        adj.reason,
        adj.operator
      ]);
    });
    
    lines.push(table(adjTable, {
      border: getBorderStyle()
    }));
  }

  if (data.staffDetails) {
    lines.push('【六、导购提成来源明细】');
    lines.push('═'.repeat(80));
    
    for (const [staffCode, details] of Object.entries(data.staffDetails)) {
      lines.push('');
      lines.push(chalk.bold(`导购: ${details.staffCode} - ${details.staffName || '未知'}`));
      lines.push(`汇总: 销售 ¥${formatMoney(details.summary.salesCommission)} | 退货 ¥${formatMoney(details.summary.returnDeduction)} | 净额 ¥${formatMoney(details.summary.netCommission)}`);
      lines.push('─'.repeat(60));
      
      const detailTable = [
        ['类型', '订单号', '金额', '提成', '规则', '扣减原因']
      ];
      
      details.details.forEach(d => {
        const typeColor = d.commission_type === 'sale' ? chalk.green : chalk.red;
        detailTable.push([
          typeColor(d.commission_type === 'sale' ? '销售' : '退货'),
          d.order_no || d.return_no || '-',
          `¥${formatMoney(d.base_amount)}`,
          d.commission_amount >= 0 ? chalk.green(`¥${formatMoney(d.commission_amount)}`) : chalk.red(`¥${formatMoney(d.commission_amount)}`),
          d.calculation_rule || '-',
          d.deduction_reason || '-'
        ]);
      });
      
      lines.push(table(detailTable, {
        border: getBorderStyle(),
        columns: [
          { width: 6 },
          { width: 14 },
          { width: 12 },
          { width: 12 },
          { width: 28 },
          { width: 20 }
        ]
      }));
    }
  }

  lines.push('');
  lines.push('═'.repeat(80));
  lines.push('报告结束');
  lines.push('═'.repeat(80));

  return lines.join('\n');
}

function formatPeriod(period) {
  const year = period.slice(0, 4);
  const month = period.slice(4, 6);
  return `${year}年${month}月`;
}

function getBorderStyle() {
  return {
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
  };
}

module.exports = {
  generateReport,
  generateReportContent
};
