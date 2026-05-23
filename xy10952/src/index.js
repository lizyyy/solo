#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

function colorize(color, text) {
  return colors[color] + text + colors.reset;
}

function parseArgs(args) {
  const options = {
    orders: './data/orders.csv',
    leaders: './data/leaders.csv',
    refunds: './data/refunds.csv',
    commission: './data/commission.json',
    output: './output',
    append: false,
    force: false,
    format: 'terminal,json,csv,report',
    quiet: false,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-V':
      case '--version':
        options.version = true;
        break;
      case '-o':
      case '--orders':
        if (nextArg && !nextArg.startsWith('-')) {
          options.orders = nextArg;
          i++;
        }
        break;
      case '-l':
      case '--leaders':
        if (nextArg && !nextArg.startsWith('-')) {
          options.leaders = nextArg;
          i++;
        }
        break;
      case '-r':
      case '--refunds':
        if (nextArg && !nextArg.startsWith('-')) {
          options.refunds = nextArg;
          i++;
        }
        break;
      case '-c':
      case '--commission':
        if (nextArg && !nextArg.startsWith('-')) {
          options.commission = nextArg;
          i++;
        }
        break;
      case '-O':
      case '--output':
        if (nextArg && !nextArg.startsWith('-')) {
          options.output = nextArg;
          i++;
        }
        break;
      case '--format':
        if (nextArg && !nextArg.startsWith('-')) {
          options.format = nextArg;
          i++;
        }
        break;
      case '--append':
        options.append = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: order-split [options]

社群订单分账CLI工具

Options:
  -V, --version              output the version number
  -o, --orders <path>        订单数据文件路径 (CSV/JSON) (default: "./data/orders.csv")
  -l, --leaders <path>       团长数据文件路径 (CSV/JSON) (default: "./data/leaders.csv")
  -r, --refunds <path>       退款数据文件路径 (CSV/JSON) (default: "./data/refunds.csv")
  -c, --commission <path>    佣金配置文件路径 (JSON) (default: "./data/commission.json")
  -O, --output <dir>         输出目录 (default: "./output")
  --format <formats>         输出格式，逗号分隔: terminal,json,csv,report (default: "terminal,json,csv,report")
  --append                   追加模式：不覆盖已有报告，追加新数据
  --force                    强制模式：覆盖已有报告文件
  --quiet                    静默模式，仅输出错误和关键信息
  -h, --help                 display help for command
`);
}

function getValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function validateOrderRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!getValue(row, 'orderId', '订单ID', 'order_id')) {
    errors.push('缺少订单ID');
  }

  if (!getValue(row, 'leaderId', '团长ID', 'leader_id')) {
    errors.push('缺少团长ID');
  }

  const amountRaw = row.amount ?? row['金额'] ?? row['订单金额'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少订单金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('订单金额无效');
  }

  const quantity = parseInt(getValue(row, 'quantity', '数量') || 1);
  if (isNaN(quantity) || quantity < 0) {
    warnings.push('数量无效，默认使用 1');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
}

function validateRefundRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!getValue(row, 'orderId', '订单ID', 'order_id')) {
    errors.push('缺少关联订单ID');
  }

  const amountRaw = row.amount ?? row['退款金额'] ?? row['refund_amount'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少退款金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('退款金额无效');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
}

function calculateCommissionRate(totalSales, tiers) {
  if (!tiers || tiers.length === 0) {
    return 0.1;
  }

  const sortedTiers = [...tiers].sort((a, b) => b.minSales - a.minSales);
  for (const tier of sortedTiers) {
    if (totalSales >= tier.minSales) {
      return tier.rate;
    }
  }

  return sortedTiers[sortedTiers.length - 1]?.rate || 0.1;
}

function formatMoney(amount) {
  return '¥' + amount.toFixed(2);
}

function formatPercent(rate) {
  return (rate * 100).toFixed(1) + '%';
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.version) {
    console.log('1.0.0');
    process.exit(0);
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const config = {
    ...options,
    formats: options.format.split(',').map(f => f.trim())
  };

  if (!config.quiet) {
    console.log(colorize('blue', '\n╔════════════════════════════════════════╗'));
    console.log(colorize('blue', '║       社群订单分账 CLI 工具 v1.0       ║'));
    console.log(colorize('blue', '╚════════════════════════════════════════╝\n'));
  }

  const absolutePaths = {
    orders: resolve(config.orders),
    leaders: resolve(config.leaders),
    refunds: resolve(config.refunds),
    commission: resolve(config.commission),
    output: resolve(config.output)
  };

  if (!config.quiet) {
    console.log(colorize('gray', '输入文件路径：'));
    console.log(colorize('gray', `  订单: ${absolutePaths.orders}`));
    console.log(colorize('gray', `  团长: ${absolutePaths.leaders}`));
    console.log(colorize('gray', `  退款: ${absolutePaths.refunds}`));
    console.log(colorize('gray', `  佣金: ${absolutePaths.commission}`));
    console.log(colorize('gray', `  输出: ${absolutePaths.output}\n`));
  }

  if (!fs.existsSync(absolutePaths.output)) {
    fs.mkdirSync(absolutePaths.output, { recursive: true });
    if (!config.quiet) {
      console.log(colorize('yellow', `创建输出目录: ${absolutePaths.output}`));
    }
  }

  if (!config.quiet) {
    console.log(colorize('cyan', '正在校验输入文件...'));
  }

  const requiredFiles = ['orders', 'leaders', 'refunds', 'commission'];
  const validationErrors = [];
  requiredFiles.forEach(fileType => {
    const filePath = absolutePaths[fileType];
    if (!fs.existsSync(filePath)) {
      validationErrors.push(`${fileType} 文件不存在: ${filePath}`);
    }
  });

  if (validationErrors.length > 0) {
    console.error(colorize('red', '\n✗ 输入文件校验失败：'));
    validationErrors.forEach(err => {
      console.error(colorize('red', `  • ${err}`));
    });
    process.exit(1);
  }

  if (!config.quiet) {
    console.log(colorize('green', '✓ 输入文件校验通过\n'));
    console.log(colorize('cyan', '正在处理分账数据...'));
  }

  const ordersCSV = fs.readFileSync(absolutePaths.orders, 'utf-8');
  const orders = parseCSV(ordersCSV);

  const leadersCSV = fs.readFileSync(absolutePaths.leaders, 'utf-8');
  const leaders = parseCSV(leadersCSV);

  const refundsCSV = fs.readFileSync(absolutePaths.refunds, 'utf-8');
  const refunds = parseCSV(refundsCSV);

  const commissionConfig = JSON.parse(fs.readFileSync(absolutePaths.commission, 'utf-8'));

  const leaderMap = new Map();
  leaders.forEach(row => {
    const leaderId = getValue(row, '团长ID', 'leaderId', 'leader_id');
    const name = getValue(row, '姓名', 'name', '团长名称') || leaderId;
    leaderMap.set(leaderId, {
      leaderId,
      name,
      orders: [],
      totalSales: 0,
      totalRefunds: 0,
      netSales: 0,
      commission: 0,
      commissionRate: 0
    });
  });

  const refundMap = new Map();
  const refundErrors = [];
  refunds.forEach((row, index) => {
    const rowIndex = index + 2;
    const validation = validateRefundRow(row, rowIndex);
    if (!validation.valid) {
      refundErrors.push({
        rowIndex,
        type: 'refund',
        errors: validation.errors,
        originalRow: row
      });
      return;
    }
    const orderId = getValue(row, '订单ID', 'orderId', 'order_id');
    const amount = parseFloat(getValue(row, '退款金额', 'amount', 'refund_amount'));
    if (!refundMap.has(orderId)) {
      refundMap.set(orderId, []);
    }
    refundMap.get(orderId).push({
      amount,
      reason: getValue(row, '退款原因', 'reason') || ''
    });
  });

  const orderDetails = [];
  const errors = [...refundErrors];
  const seenOrders = new Set();

  orders.forEach((row, index) => {
    const rowIndex = index + 2;
    const validation = validateOrderRow(row, rowIndex);

    if (!validation.valid) {
      errors.push({
        rowIndex,
        type: 'order',
        errors: validation.errors,
        originalRow: row
      });
      return;
    }

    const orderId = getValue(row, '订单ID', 'orderId', 'order_id');
    const leaderId = getValue(row, '团长ID', 'leaderId', 'leader_id');
    const amount = parseFloat(getValue(row, '金额', 'amount', '订单金额'));

    if (seenOrders.has(orderId)) {
      errors.push({
        rowIndex,
        type: 'duplicate',
        errors: [`重复订单 ID: ${orderId}`],
        originalRow: row
      });
      return;
    }

    seenOrders.add(orderId);

    const quantity = parseInt(getValue(row, '数量') || 1);
    const productName = getValue(row, '商品名称', 'productName', '产品') || '';

    const orderRefunds = refundMap.get(orderId) || [];
    const totalRefundAmount = orderRefunds.reduce((sum, r) => sum + r.amount, 0);
    const netAmount = Math.max(0, amount - totalRefundAmount);

    const orderDetail = {
      orderId,
      leaderId,
      leaderName: leaderMap.get(leaderId)?.name || leaderId,
      productName,
      quantity,
      originalAmount: amount,
      refundAmount: totalRefundAmount,
      netAmount,
      hasRefund: totalRefundAmount > 0,
      refunds: orderRefunds,
      rowIndex
    };

    orderDetails.push(orderDetail);

    if (leaderMap.has(leaderId)) {
      const leader = leaderMap.get(leaderId);
      leader.orders.push(orderDetail);
      leader.totalSales += amount;
      leader.totalRefunds += totalRefundAmount;
      leader.netSales += netAmount;
    }
  });

  const tiers = commissionConfig.commissionTiers || commissionConfig.tieredCommission;
  const platformFeeRate = commissionConfig.platformFeeRate;

  const leaderCommission = [];
  let totalPlatformFees = 0;
  let totalCommission = 0;

  for (const [leaderId, leader] of leaderMap.entries()) {
    const rate = calculateCommissionRate(leader.netSales, tiers);
    const commission = leader.netSales * rate;
    const platformFee = leader.netSales * platformFeeRate;

    leader.commissionRate = rate;
    leader.commission = commission;

    leaderCommission.push({
      leaderId,
      name: leader.name,
      orderCount: leader.orders.length,
      totalSales: leader.totalSales,
      totalRefunds: leader.totalRefunds,
      netSales: leader.netSales,
      commissionRate: rate,
      commission: commission,
      platformFee: platformFee,
      finalAmount: commission - platformFee
    });

    totalPlatformFees += platformFee;
    totalCommission += commission;
  }

  const totalSales = orderDetails.reduce((sum, o) => sum + o.originalAmount, 0);
  const totalRefunds = orderDetails.reduce((sum, o) => sum + o.refundAmount, 0);
  const totalNetSales = orderDetails.reduce((sum, o) => sum + o.netAmount, 0);

  const refundOffsets = [];
  orderDetails.filter(o => o.hasRefund).forEach(o => {
    o.refunds.forEach((r, idx) => {
      refundOffsets.push({
        orderId: o.orderId,
        leaderId: o.leaderId,
        leaderName: o.leaderName,
        originalAmount: o.originalAmount,
        refundAmount: r.amount,
        refundReason: r.reason,
        netAfterRefund: o.netAmount,
        refundIndex: idx + 1
      });
    });
  });

  const result = {
    summary: {
      generatedAt: new Date().toISOString(),
      totalOrders: orderDetails.length,
      totalUniqueOrders: orderDetails.length,
      totalDuplicateOrders: errors.filter(e => e.type === 'duplicate').length,
      totalLeaders: leaderCommission.length,
      totalSales,
      totalRefunds,
      totalNetSales,
      totalCommission,
      totalPlatformFees,
      platformFeeRate,
      errorCount: errors.length,
      warningCount: 0
    },
    orderDetails,
    leaderCommission,
    refundOffsets,
    errors,
    warnings: []
  };

  if (!config.quiet) {
    console.log(colorize('green', '✓ 分账处理完成\n'));
  }

  if (config.formats.includes('terminal') && !config.quiet) {
    console.log(colorize('cyan', '════════════════════════════════════════════════════════════════════'));
    console.log(colorize('cyan', colorize('bold', '\n📊 分账汇总报告\n')));

    console.log('┌──────────────────────────────┬──────────────────────────────┐');
    console.log('│ 项目                         │ 数值                         │');
    console.log('├──────────────────────────────┼──────────────────────────────┤');
    console.log(`│ ${padRight('生成时间', 28)} │ ${padRight(new Date(result.summary.generatedAt).toLocaleString('zh-CN'), 28)} │`);
    console.log(`│ ${padRight('总订单数', 28)} │ ${padRight(String(result.summary.totalOrders), 28)} │`);
    console.log(`│ ${padRight('重复订单数', 28)} │ ${padRight(String(result.summary.totalDuplicateOrders), 28)} │`);
    console.log(`│ ${padRight('团长总数', 28)} │ ${padRight(String(result.summary.totalLeaders), 28)} │`);
    console.log(`│ ${padRight('总销售额', 28)} │ ${padRight(formatMoney(result.summary.totalSales), 28)} │`);
    console.log(`│ ${padRight('总退款金额', 28)} │ ${padRight(formatMoney(result.summary.totalRefunds), 28)} │`);
    console.log(`│ ${padRight('净销售额', 28)} │ ${padRight(formatMoney(result.summary.totalNetSales), 28)} │`);
    console.log(`│ ${padRight('总佣金金额', 28)} │ ${padRight(formatMoney(result.summary.totalCommission), 28)} │`);
    console.log(`│ ${padRight('平台服务费总额', 28)} │ ${padRight(formatMoney(result.summary.totalPlatformFees), 28)} │`);
    console.log(`│ ${padRight('服务费比例', 28)} │ ${padRight(formatPercent(result.summary.platformFeeRate), 28)} │`);
    console.log(`│ ${padRight('错误数量', 28)} │ ${padRight(String(result.summary.errorCount), 28)} │`);
    console.log('└──────────────────────────────┴──────────────────────────────┘');
    console.log();

    if (leaderCommission.length > 0) {
      console.log(colorize('cyan', colorize('bold', '\n👥 团长佣金明细\n')));

      console.log('┌────────────┬────────────┬──────────┬──────────────┬────────────┬────────────┬────────────┬────────────┐');
      console.log('│ 团长ID     │ 姓名       │ 订单数   │ 净销售额     │ 佣金比例   │ 佣金       │ 平台费     │ 实得       │');
      console.log('├────────────┼────────────┼──────────┼──────────────┼────────────┼────────────┼────────────┼────────────┤');

      leaderCommission.forEach(leader => {
        console.log(`│ ${padRight(leader.leaderId, 10)} │ ${padRight(leader.name, 10)} │ ${padRight(String(leader.orderCount), 8)} │ ${padRight(formatMoney(leader.netSales), 12)} │ ${padRight(formatPercent(leader.commissionRate), 10)} │ ${padRight(formatMoney(leader.commission), 10)} │ ${padRight(formatMoney(leader.platformFee), 10)} │ ${padRight(formatMoney(leader.finalAmount), 10)} │`);
      });

      console.log('└────────────┴────────────┴──────────┴──────────────┴────────────┴────────────┴────────────┴────────────┘');
    }

    if (errors.length > 0) {
      console.log(colorize('red', colorize('bold', '\n⚠️  异常数据记录 (保留原始位置)\n')));

      console.log('┌──────────┬────────────┬──────────────────────────────┬──────────────────────────────┐');
      console.log('│ 行号     │ 类型       │ 错误信息                     │ 原始数据                     │');
      console.log('├──────────┼────────────┼──────────────────────────────┼──────────────────────────────┤');

      errors.slice(0, 10).forEach(err => {
        const errorMsg = err.errors?.join('; ') || '-';
        const originalData = JSON.stringify(err.originalRow || '-').substring(0, 25) + '...';
        console.log(`│ ${padRight(String(err.rowIndex || '-'), 8)} │ ${padRight(err.type || '-', 10)} │ ${padRight(errorMsg.substring(0, 28), 28)} │ ${padRight(originalData.substring(0, 28), 28)} │`);
      });

      console.log('└──────────┴────────────┴──────────────────────────────┴──────────────────────────────┘');

      if (errors.length > 10) {
        console.log(colorize('yellow', `\n还有 ${errors.length - 10} 条错误记录，详见 JSON 输出文件`));
      }
    }

    console.log();
  }

  const outputDir = absolutePaths.output;

  if (config.formats.includes('json')) {
    const jsonPath = resolve(outputDir, 'split-summary.json');
    if (fs.existsSync(jsonPath) && !config.force && !config.append) {
      console.log(colorize('yellow', `⚠  文件已存在，跳过: ${jsonPath} (使用 --force 覆盖或 --append 追加)`));
    } else {
      let outputData = result;
      if (config.append && fs.existsSync(jsonPath)) {
        const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        outputData = { appendedAt: new Date().toISOString(), previous: existing, current: result };
      }
      fs.writeFileSync(jsonPath, JSON.stringify(outputData, null, 2), 'utf-8');
      if (!config.quiet) {
        console.log(colorize('green', `✓ 已生成 JSON 汇总: ${jsonPath}`));
      }
    }
  }

  if (config.formats.includes('csv')) {
    const detailsPath = resolve(outputDir, 'split-details.csv');
    if (!fs.existsSync(detailsPath) || config.force || config.append) {
      const detailsHeader = '订单ID,团长ID,团长名称,商品名称,数量,原金额,退款金额,净额,原始行号\n';
      const detailsRows = orderDetails.map(o =>
        `${o.orderId},${o.leaderId},${o.leaderName},${o.productName},${o.quantity},${o.originalAmount},${o.refundAmount},${o.netAmount},${o.rowIndex}`
      ).join('\n');
      const detailsContent = config.append && fs.existsSync(detailsPath)
        ? '\n' + detailsRows
        : '\uFEFF' + detailsHeader + detailsRows;
      if (config.append && fs.existsSync(detailsPath)) {
        fs.appendFileSync(detailsPath, detailsContent, 'utf-8');
      } else {
        fs.writeFileSync(detailsPath, detailsContent, 'utf-8');
      }
      if (!config.quiet) {
        console.log(colorize('green', `✓ 已生成订单明细 CSV: ${detailsPath}`));
      }
    } else if (!config.quiet) {
      console.log(colorize('yellow', `⚠  文件已存在，跳过: ${detailsPath}`));
    }

    const leaderPath = resolve(outputDir, 'leader-commission.csv');
    if (!fs.existsSync(leaderPath) || config.force || config.append) {
      const leaderHeader = '团长ID,姓名,订单数,总销售额,总退款,净销售额,佣金比例,佣金,平台费,实得金额\n';
      const leaderRows = leaderCommission.map(l =>
        `${l.leaderId},${l.name},${l.orderCount},${l.totalSales},${l.totalRefunds},${l.netSales},${l.commissionRate},${l.commission},${l.platformFee},${l.finalAmount}`
      ).join('\n');
      const leaderContent = config.append && fs.existsSync(leaderPath)
        ? '\n' + leaderRows
        : '\uFEFF' + leaderHeader + leaderRows;
      if (config.append && fs.existsSync(leaderPath)) {
        fs.appendFileSync(leaderPath, leaderContent, 'utf-8');
      } else {
        fs.writeFileSync(leaderPath, leaderContent, 'utf-8');
      }
      if (!config.quiet) {
        console.log(colorize('green', `✓ 已生成团长佣金 CSV: ${leaderPath}`));
      }
    } else if (!config.quiet) {
      console.log(colorize('yellow', `⚠  文件已存在，跳过: ${leaderPath}`));
    }

    if (refundOffsets.length > 0) {
      const refundPath = resolve(outputDir, 'refund-offsets.csv');
      if (!fs.existsSync(refundPath) || config.force || config.append) {
        const refundHeader = '订单ID,团长ID,团长名称,原金额,退款金额,退款原因,净额\n';
        const refundRows = refundOffsets.map(r =>
          `${r.orderId},${r.leaderId},${r.leaderName},${r.originalAmount},${r.refundAmount},${r.refundReason},${r.netAfterRefund}`
        ).join('\n');
        const refundContent = config.append && fs.existsSync(refundPath)
          ? '\n' + refundRows
          : '\uFEFF' + refundHeader + refundRows;
        if (config.append && fs.existsSync(refundPath)) {
          fs.appendFileSync(refundPath, refundContent, 'utf-8');
        } else {
          fs.writeFileSync(refundPath, refundContent, 'utf-8');
        }
        if (!config.quiet) {
          console.log(colorize('green', `✓ 已生成退款冲抵 CSV: ${refundPath}`));
        }
      } else if (!config.quiet) {
        console.log(colorize('yellow', `⚠  文件已存在，跳过: ${refundPath}`));
      }
    }

    const errorsPath = resolve(outputDir, 'errors.json');
    if (!fs.existsSync(errorsPath) || config.force || config.append) {
      let errorData = errors;
      if (config.append && fs.existsSync(errorsPath)) {
        const existing = JSON.parse(fs.readFileSync(errorsPath, 'utf-8'));
        errorData = Array.isArray(existing) ? [...existing, ...errors] : [existing, errors];
      }
      fs.writeFileSync(errorsPath, JSON.stringify(errorData, null, 2), 'utf-8');
      if (!config.quiet) {
        console.log(colorize('green', `✓ 已生成错误记录 JSON: ${errorsPath}`));
      }
    } else if (!config.quiet) {
      console.log(colorize('yellow', `⚠  文件已存在，跳过: ${errorsPath}`));
    }
  }

  if (config.formats.includes('report')) {
    const reportPath = resolve(outputDir, 'report.md');
    let md = `# 社群订单分账报告\n\n`;
    md += `生成时间: ${new Date(result.summary.generatedAt).toLocaleString('zh-CN')}\n\n`;

    md += `## 汇总数据\n\n`;
    md += `| 项目 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总订单数 | ${result.summary.totalOrders} |\n`;
    md += `| 重复订单数 | ${result.summary.totalDuplicateOrders} |\n`;
    md += `| 团长总数 | ${result.summary.totalLeaders} |\n`;
    md += `| 总销售额 | ${formatMoney(result.summary.totalSales)} |\n`;
    md += `| 总退款金额 | ${formatMoney(result.summary.totalRefunds)} |\n`;
    md += `| 净销售额 | ${formatMoney(result.summary.totalNetSales)} |\n`;
    md += `| 总佣金金额 | ${formatMoney(result.summary.totalCommission)} |\n`;
    md += `| 平台服务费总额 | ${formatMoney(result.summary.totalPlatformFees)} |\n`;
    md += `| 服务费比例 | ${formatPercent(result.summary.platformFeeRate)} |\n`;
    md += `| 异常记录数 | ${result.summary.errorCount} |\n\n`;

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

    if (fs.existsSync(reportPath) && !config.force && !config.append) {
      console.log(colorize('yellow', `⚠  文件已存在，跳过: ${reportPath}`));
    } else {
      if (config.append && fs.existsSync(reportPath)) {
        fs.appendFileSync(reportPath, '\n\n---\n\n' + md, 'utf-8');
      } else {
        fs.writeFileSync(reportPath, md, 'utf-8');
      }
      if (!config.quiet) {
        console.log(colorize('green', `✓ 已生成 Markdown 报告: ${reportPath}`));
      }
    }
  }

  if (!config.quiet) {
    console.log(colorize('green', '\n✓ 所有报告已生成完成！'));
    console.log(colorize('gray', `输出目录: ${outputDir}\n`));
  }
}

main().catch(error => {
  console.error(colorize('red', '\n✗ 程序执行出错：'));
  console.error(colorize('red', `  ${error.message}`));
  process.exit(1);
});
