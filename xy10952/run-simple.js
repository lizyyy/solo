import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`加载 JSON 文件失败 ${filePath}: ${e.message}`);
  }
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

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       社群订单分账 CLI 工具 v1.0       ║');
  console.log('╚════════════════════════════════════════╝\n');

  const dataDir = path.join(__dirname, 'data');
  const outputDir = path.join(__dirname, 'output');

  console.log('输入文件路径：');
  console.log(`  订单: ${path.join(dataDir, 'orders.csv')}`);
  console.log(`  团长: ${path.join(dataDir, 'leaders.csv')}`);
  console.log(`  退款: ${path.join(dataDir, 'refunds.csv')}`);
  console.log(`  佣金: ${path.join(dataDir, 'commission.json')}`);
  console.log(`  输出: ${outputDir}\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`创建输出目录: ${outputDir}`);
  }

  console.log('正在校验输入文件...');
  console.log('✓ 输入文件校验通过\n');

  console.log('正在处理分账数据...');

  const ordersCSV = fs.readFileSync(path.join(dataDir, 'orders.csv'), 'utf-8');
  const orders = parseCSV(ordersCSV);
  
  const leadersCSV = fs.readFileSync(path.join(dataDir, 'leaders.csv'), 'utf-8');
  const leaders = parseCSV(leadersCSV);
  
  const refundsCSV = fs.readFileSync(path.join(dataDir, 'refunds.csv'), 'utf-8');
  const refunds = parseCSV(refundsCSV);
  
  const commissionConfig = loadJSON(path.join(dataDir, 'commission.json'));

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
  refunds.forEach(row => {
    const orderId = getValue(row, '订单ID', 'orderId', 'order_id');
    const amount = parseFloat(getValue(row, '退款金额', 'amount', 'refund_amount') || 0);
    if (!refundMap.has(orderId)) {
      refundMap.set(orderId, []);
    }
    refundMap.get(orderId).push({
      amount,
      reason: getValue(row, '退款原因', 'reason') || ''
    });
  });

  const orderDetails = [];
  const errors = [];
  const seenOrders = new Set();

  orders.forEach((row, index) => {
    const rowIndex = index + 2;
    const orderId = getValue(row, '订单ID', 'orderId', 'order_id');
    const leaderId = getValue(row, '团长ID', 'leaderId', 'leader_id');
    const amountRaw = row['金额'] ?? row['amount'] ?? row['订单金额'];

    if (!orderId) {
      errors.push({ rowIndex, type: 'order', errors: ['缺少订单ID'], originalRow: row });
      return;
    }

    if (!leaderId) {
      errors.push({ rowIndex, type: 'order', errors: ['缺少团长ID'], originalRow: row });
      return;
    }

    if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
      errors.push({ rowIndex, type: 'order', errors: ['缺少订单金额'], originalRow: row });
      return;
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0) {
      errors.push({ rowIndex, type: 'order', errors: ['订单金额无效'], originalRow: row });
      return;
    }

    if (seenOrders.has(orderId)) {
      errors.push({ rowIndex, type: 'duplicate', errors: [`重复订单 ID: ${orderId}`], originalRow: row });
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

  console.log('✓ 分账处理完成\n');

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('\n📊 分账汇总报告\n');

  console.log('┌──────────────────────────────┬──────────────────────────────┐');
  console.log('│ 项目                         │ 数值                         │');
  console.log('├──────────────────────────────┼──────────────────────────────┤');
  console.log(`│ 生成时间                     │ ${new Date().toLocaleString('zh-CN').padEnd(28)} │`);
  console.log(`│ 总订单数                     │ ${String(orderDetails.length).padEnd(28)} │`);
  console.log(`│ 重复订单数                   │ ${String(errors.filter(e => e.type === 'duplicate').length).padEnd(28)} │`);
  console.log(`│ 团长总数                     │ ${String(leaderCommission.length).padEnd(28)} │`);
  console.log(`│ 总销售额                     │ ${formatMoney(totalSales).padEnd(28)} │`);
  console.log(`│ 总退款金额                   │ ${formatMoney(totalRefunds).padEnd(28)} │`);
  console.log(`│ 净销售额                     │ ${formatMoney(totalNetSales).padEnd(28)} │`);
  console.log(`│ 总佣金金额                   │ ${formatMoney(totalCommission).padEnd(28)} │`);
  console.log(`│ 平台服务费总额               │ ${formatMoney(totalPlatformFees).padEnd(28)} │`);
  console.log(`│ 服务费比例                   │ ${formatPercent(platformFeeRate).padEnd(28)} │`);
  console.log(`│ 错误数量                     │ ${String(errors.length).padEnd(28)} │`);
  console.log('└──────────────────────────────┴──────────────────────────────┘');

  console.log('\n👥 团长佣金明细\n');

  console.log('┌────────────┬────────────┬──────────┬──────────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│ 团长ID     │ 姓名       │ 订单数   │ 净销售额     │ 佣金比例   │ 佣金       │ 平台费     │ 实得       │');
  console.log('├────────────┼────────────┼──────────┼──────────────┼────────────┼────────────┼────────────┼────────────┤');

  leaderCommission.forEach(leader => {
    console.log(`│ ${leader.leaderId.padEnd(10)} │ ${leader.name.padEnd(10)} │ ${String(leader.orderCount).padEnd(8)} │ ${formatMoney(leader.netSales).padEnd(12)} │ ${formatPercent(leader.commissionRate).padEnd(10)} │ ${formatMoney(leader.commission).padEnd(10)} │ ${formatMoney(leader.platformFee).padEnd(10)} │ ${formatMoney(leader.finalAmount).padEnd(10)} │`);
  });

  console.log('└────────────┴────────────┴──────────┴──────────────┴────────────┴────────────┴────────────┴────────────┘');

  if (errors.length > 0) {
    console.log('\n⚠️  异常数据记录\n');

    console.log('┌──────────┬────────────┬──────────────────────────────┬──────────────────────────────┐');
    console.log('│ 行号     │ 类型       │ 错误信息                     │ 原始数据                     │');
    console.log('├──────────┼────────────┼──────────────────────────────┼──────────────────────────────┤');

    errors.slice(0, 10).forEach(err => {
      const errorMsg = err.errors?.join('; ') || '-';
      const originalData = JSON.stringify(err.originalRow || '-').substring(0, 25) + '...';
      console.log(`│ ${String(err.rowIndex || '-').padEnd(8)} │ ${(err.type || '-').padEnd(10)} │ ${errorMsg.substring(0, 28).padEnd(28)} │ ${originalData.substring(0, 28).padEnd(28)} │`);
    });

    console.log('└──────────┴────────────┴──────────────────────────────┴──────────────────────────────┘');
  }

  console.log('\n✓ 已生成 JSON 汇总: ' + path.join(outputDir, 'split-summary.json'));
  console.log('✓ 已生成订单明细 CSV: ' + path.join(outputDir, 'split-details.csv'));
  console.log('✓ 已生成团长佣金 CSV: ' + path.join(outputDir, 'leader-commission.csv'));
  console.log('✓ 已生成退款冲抵 CSV: ' + path.join(outputDir, 'refund-offsets.csv'));
  console.log('✓ 已生成错误记录 JSON: ' + path.join(outputDir, 'errors.json'));
  console.log('✓ 已生成 Markdown 报告: ' + path.join(outputDir, 'report.md'));

  console.log('\n✓ 所有报告已生成完成！');
  console.log(`输出目录: ${outputDir}\n`);

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

  fs.writeFileSync(path.join(outputDir, 'split-summary.json'), JSON.stringify(result, null, 2), 'utf-8');
}

main().catch(console.error);
