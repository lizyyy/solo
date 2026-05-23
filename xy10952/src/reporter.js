import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { stringify } from 'csv-stringify/sync';
import { checkOutputConflicts, resolveFileConflict } from './config.js';

function formatMoney(amount) {
  return '¥' + amount.toFixed(2);
}

function formatPercent(rate) {
  return (rate * 100).toFixed(1) + '%';
}

function printTerminalSummary(result) {
  const { summary, leaderCommission, errors } = result;

  console.log(chalk.cyan('════════════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('\n📊 分账汇总报告\n'));

  const summaryTable = new Table({
    head: [chalk.white('项目'), chalk.white('数值')],
    colWidths: [30, 30]
  });

  summaryTable.push(
    ['生成时间', new Date(summary.generatedAt).toLocaleString('zh-CN')],
    ['总订单数', summary.totalOrders],
    ['重复订单数', summary.totalDuplicateOrders],
    ['团长总数', summary.totalLeaders],
    ['总销售额', formatMoney(summary.totalSales)],
    ['总退款金额', formatMoney(summary.totalRefunds)],
    ['净销售额', formatMoney(summary.totalNetSales)],
    ['总佣金金额', formatMoney(summary.totalCommission)],
    ['平台服务费总额', formatMoney(summary.totalPlatformFees)],
    ['服务费比例', formatPercent(summary.platformFeeRate)],
    ['错误数量', summary.errorCount],
    ['警告数量', summary.warningCount]
  );

  console.log(summaryTable.toString());
  console.log();

  if (leaderCommission.length > 0) {
    console.log(chalk.cyan.bold('\n👥 团长佣金明细\n'));

    const leaderTable = new Table({
      head: [
        chalk.white('团长ID'),
        chalk.white('姓名'),
        chalk.white('订单数'),
        chalk.white('净销售额'),
        chalk.white('佣金比例'),
        chalk.white('佣金'),
        chalk.white('平台费'),
        chalk.white('实得')
      ],
      colWidths: [12, 12, 10, 14, 12, 12, 12, 12]
    });

    leaderCommission.forEach(leader => {
      leaderTable.push([
        leader.leaderId,
        leader.name,
        leader.orderCount,
        formatMoney(leader.netSales),
        formatPercent(leader.commissionRate),
        formatMoney(leader.commission),
        formatMoney(leader.platformFee),
        formatMoney(leader.finalAmount)
      ]);
    });

    console.log(leaderTable.toString());
  }

  if (errors.length > 0) {
    console.log(chalk.red.bold('\n⚠️  异常数据记录 (保留原始位置)\n'));

    const errorTable = new Table({
      head: [
        chalk.white('行号'),
        chalk.white('类型'),
        chalk.white('错误信息'),
        chalk.white('原始数据')
      ],
      colWidths: [10, 12, 30, 30]
    });

    errors.slice(0, 10).forEach(err => {
      errorTable.push([
        err.rowIndex || '-',
        err.type || '-',
        err.errors?.join('; ') || '-',
        err.originalRow ? JSON.stringify(err.originalRow).substring(0, 25) + '...' : '-'
      ]);
    });

    console.log(errorTable.toString());

    if (errors.length > 10) {
      console.log(chalk.yellow(`\n还有 ${errors.length - 10} 条错误记录，详见 errors.json 文件`));
    }
  }

  console.log();
}

async function writeJSON(filePath, data, config) {
  const action = resolveFileConflict(filePath, config);

  if (action === 'error' && fs.existsSync(filePath)) {
    throw new Error(`文件已存在: ${filePath}，使用 --force 覆盖或 --append 追加`);
  }

  let outputData = data;
  if (action === 'append' && fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(existing) && Array.isArray(data)) {
      outputData = [...existing, ...data];
    } else {
      outputData = { appendedAt: new Date().toISOString(), previous: existing, current: data };
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf-8');
}

async function writeCSV(filePath, data, columns, config) {
  const action = resolveFileConflict(filePath, config);

  if (action === 'error' && fs.existsSync(filePath)) {
    throw new Error(`文件已存在: ${filePath}，使用 --force 覆盖或 --append 追加`);
  }

  const csvContent = stringify(data, {
    header: action !== 'append' || !fs.existsSync(filePath),
    columns,
    encoding: 'utf-8'
  });

  if (action === 'append' && fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, '\n' + csvContent, 'utf-8');
  } else {
    fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf-8');
  }
}

function generateMarkdownReport(result) {
  const { summary, leaderCommission, refundOffsets, errors } = result;

  let md = `# 社群订单分账报告\n\n`;
  md += `生成时间: ${new Date(summary.generatedAt).toLocaleString('zh-CN')}\n\n`;

  md += `## 汇总数据\n\n`;
  md += `| 项目 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总订单数 | ${summary.totalOrders} |\n`;
  md += `| 重复订单数 | ${summary.totalDuplicateOrders} |\n`;
  md += `| 团长总数 | ${summary.totalLeaders} |\n`;
  md += `| 总销售额 | ${formatMoney(summary.totalSales)} |\n`;
  md += `| 总退款金额 | ${formatMoney(summary.totalRefunds)} |\n`;
  md += `| 净销售额 | ${formatMoney(summary.totalNetSales)} |\n`;
  md += `| 总佣金金额 | ${formatMoney(summary.totalCommission)} |\n`;
  md += `| 平台服务费总额 | ${formatMoney(summary.totalPlatformFees)} |\n`;
  md += `| 服务费比例 | ${formatPercent(summary.platformFeeRate)} |\n`;
  md += `| 异常记录数 | ${summary.errorCount} |\n\n`;

  md += `## 团长佣金明细\n\n`;
  md += `| 团长ID | 姓名 | 订单数 | 净销售额 | 佣金比例 | 佣金 | 平台费 | 实得 |\n`;
  md += `|--------|------|--------|----------|----------|------|--------|------|\n`;
  leaderCommission.forEach(leader => {
    md += `| ${leader.leaderId} | ${leader.name} | ${leader.orderCount} | ${formatMoney(leader.netSales)} | ${formatPercent(leader.commissionRate)} | ${formatMoney(leader.commission)} | ${formatMoney(leader.platformFee)} | ${formatMoney(leader.finalAmount)} |\n`;
  });
  md += `\n`;

  if (refundOffsets.length > 0) {
    md += `## 退款冲抵明细\n\n`;
    md += `| 订单ID | 团长ID | 团长名称 | 原金额 | 退款金额 | 退款原因 | 净额 |\n`;
    md += `|--------|--------|----------|--------|----------|----------|------|\n`;
    refundOffsets.forEach(refund => {
      md += `| ${refund.orderId} | ${refund.leaderId} | ${refund.leaderName} | ${formatMoney(refund.originalAmount)} | ${formatMoney(refund.refundAmount)} | ${refund.refundReason} | ${formatMoney(refund.netAfterRefund)} |\n`;
    });
    md += `\n`;
  }

  if (errors.length > 0) {
    md += `## 异常数据记录\n\n`;
    md += `| 原始行号 | 类型 | 错误信息 | 原始数据 |\n`;
    md += `|----------|------|----------|----------|\n`;
    errors.forEach(err => {
      md += `| ${err.rowIndex || '-'} | ${err.type || '-'} | ${err.errors?.join('; ') || '-'} | ${JSON.stringify(err.originalRow || '-')} |\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*本报告由社群订单分账工具自动生成*\n`;

  return md;
}

export async function generateReports(result, outputDir, config) {
  const conflicts = checkOutputConflicts(outputDir, config);
  if (!config.quiet && conflicts.length > 0 && !config.force && !config.append) {
    console.log(chalk.yellow(`警告: 输出目录已有文件 (${conflicts.join(', ')})`));
    console.log(chalk.yellow(`使用 --force 覆盖或 --append 追加\n`));
  }

  if (config.formats.includes('terminal') && !config.quiet) {
    printTerminalSummary(result);
  }

  if (config.formats.includes('json')) {
    const jsonPath = path.join(outputDir, 'split-summary.json');
    await writeJSON(jsonPath, result, config);
    if (!config.quiet) {
      console.log(chalk.green(`✓ 已生成 JSON 汇总: ${jsonPath}`));
    }
  }

  if (config.formats.includes('csv')) {
    const detailsPath = path.join(outputDir, 'split-details.csv');
    await writeCSV(detailsPath, result.orderDetails, [
      { key: 'orderId', header: '订单ID' },
      { key: 'leaderId', header: '团长ID' },
      { key: 'leaderName', header: '团长名称' },
      { key: 'productName', header: '商品名称' },
      { key: 'quantity', header: '数量' },
      { key: 'originalAmount', header: '原金额' },
      { key: 'refundAmount', header: '退款金额' },
      { key: 'netAmount', header: '净额' },
      { key: 'rowIndex', header: '原始行号' }
    ], config);
    if (!config.quiet) {
      console.log(chalk.green(`✓ 已生成订单明细 CSV: ${detailsPath}`));
    }

    const leaderPath = path.join(outputDir, 'leader-commission.csv');
    await writeCSV(leaderPath, result.leaderCommission, [
      { key: 'leaderId', header: '团长ID' },
      { key: 'name', header: '姓名' },
      { key: 'orderCount', header: '订单数' },
      { key: 'totalSales', header: '总销售额' },
      { key: 'totalRefunds', header: '总退款' },
      { key: 'netSales', header: '净销售额' },
      { key: 'commissionRate', header: '佣金比例' },
      { key: 'commission', header: '佣金' },
      { key: 'platformFee', header: '平台费' },
      { key: 'finalAmount', header: '实得金额' }
    ], config);
    if (!config.quiet) {
      console.log(chalk.green(`✓ 已生成团长佣金 CSV: ${leaderPath}`));
    }

    const refundPath = path.join(outputDir, 'refund-offsets.csv');
    if (result.refundOffsets.length > 0) {
      await writeCSV(refundPath, result.refundOffsets, [
        { key: 'orderId', header: '订单ID' },
        { key: 'leaderId', header: '团长ID' },
        { key: 'leaderName', header: '团长名称' },
        { key: 'originalAmount', header: '原金额' },
        { key: 'refundAmount', header: '退款金额' },
        { key: 'refundReason', header: '退款原因' },
        { key: 'netAfterRefund', header: '净额' },
        { key: 'orderRowIndex', header: '订单行号' },
        { key: 'refundRowIndex', header: '退款行号' }
      ], config);
      if (!config.quiet) {
        console.log(chalk.green(`✓ 已生成退款冲抵 CSV: ${refundPath}`));
      }
    }

    const errorsPath = path.join(outputDir, 'errors.json');
    await writeJSON(errorsPath, result.errors, config);
    if (!config.quiet) {
      console.log(chalk.green(`✓ 已生成错误记录 JSON: ${errorsPath}`));
    }
  }

  if (config.formats.includes('report')) {
    const reportPath = path.join(outputDir, 'report.md');
    const reportContent = generateMarkdownReport(result);
    const action = resolveFileConflict(reportPath, config);
    
    if (action === 'error' && fs.existsSync(reportPath)) {
      throw new Error(`文件已存在: ${reportPath}，使用 --force 覆盖或 --append 追加`);
    }
    
    if (action === 'append' && fs.existsSync(reportPath)) {
      fs.appendFileSync(reportPath, '\n\n---\n\n' + reportContent, 'utf-8');
    } else {
      fs.writeFileSync(reportPath, reportContent, 'utf-8');
    }
    if (!config.quiet) {
      console.log(chalk.green(`✓ 已生成 Markdown 报告: ${reportPath}`));
    }
  }
}
