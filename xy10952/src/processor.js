import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {
  validateOrderRow,
  validateLeaderRow,
  validateRefundRow,
  validateCommissionConfig,
  parseAndValidateCSV
} from './validator.js';

function getValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
}

function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`加载 JSON 文件失败 ${filePath}: ${e.message}`);
  }
}

function loadCSV(filePath, validator, type) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseAndValidateCSV(content, validator, type);
}

function loadData(filePath, validator, type) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    const data = loadJSON(filePath);
    const records = [];
    const errors = [];
    data.forEach((row, index) => {
      const validation = validator(row, index + 1);
      if (validation.valid) {
        records.push({
          data: row,
          rowIndex: index + 1,
          warnings: validation.warnings
        });
      } else {
        errors.push({
          rowIndex: index + 1,
          originalRow: row,
          errors: validation.errors,
          type
        });
      }
    });
    return { records, errors, warnings: [] };
  } else {
    return loadCSV(filePath, validator, type);
  }
}

function deduplicateOrders(orders) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  orders.forEach(item => {
    const orderId = getValue(item.data, 'orderId', '订单ID', 'order_id');
    if (seen.has(orderId)) {
      duplicates.push({
        ...item,
        duplicateOf: orderId
      });
    } else {
      seen.add(orderId);
      unique.push(item);
    }
  });

  return { unique, duplicates };
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

export async function processOrders(paths, config) {
  const allErrors = [];
  const allWarnings = [];

  const ordersResult = loadData(paths.orders, validateOrderRow, 'order');
  allErrors.push(...ordersResult.errors);
  allWarnings.push(...ordersResult.warnings);

  const leadersResult = loadData(paths.leaders, validateLeaderRow, 'leader');
  allErrors.push(...leadersResult.errors);
  allWarnings.push(...leadersResult.warnings);

  const refundsResult = loadData(paths.refunds, validateRefundRow, 'refund');
  allErrors.push(...refundsResult.errors);
  allWarnings.push(...refundsResult.warnings);

  const commissionConfig = loadJSON(paths.commission);
  const commissionValidation = validateCommissionConfig(commissionConfig);
  if (!commissionValidation.valid) {
    throw new Error(`佣金配置校验失败: ${commissionValidation.errors.join(', ')}`);
  }
  allWarnings.push(...commissionValidation.warnings.map(w => ({ type: 'commission', message: w })));

  const { unique: uniqueOrders, duplicates } = deduplicateOrders(ordersResult.records);
  duplicates.forEach(d => {
    allErrors.push({
      rowIndex: d.rowIndex,
      originalRow: d.data,
      errors: [`重复订单 ID: ${d.duplicateOf}`],
      type: 'duplicate'
    });
  });

  const leaderMap = new Map();
  leadersResult.records.forEach(item => {
    const leaderId = getValue(item.data, 'leaderId', '团长ID', 'leader_id');
    const name = getValue(item.data, 'name', '姓名', '团长名称') || leaderId;
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
  refundsResult.records.forEach(item => {
    const orderId = getValue(item.data, 'orderId', '订单ID', 'order_id');
    const amount = parseFloat(getValue(item.data, 'amount', '退款金额', 'refund_amount') || 0);
    if (!refundMap.has(orderId)) {
      refundMap.set(orderId, []);
    }
    refundMap.get(orderId).push({
      amount,
      rowIndex: item.rowIndex,
      reason: getValue(item.data, 'reason', '原因', '退款原因') || ''
    });
  });

  const orderDetails = [];
  uniqueOrders.forEach(item => {
    const orderId = getValue(item.data, 'orderId', '订单ID', 'order_id');
    const leaderId = getValue(item.data, 'leaderId', '团长ID', 'leader_id');
    const amount = parseFloat(getValue(item.data, 'amount', '金额', '订单金额') || 0);
    const quantity = parseInt(getValue(item.data, 'quantity', '数量') || 1);
    const productName = getValue(item.data, 'productName', '商品名称', '产品') || '';

    const refunds = refundMap.get(orderId) || [];
    const totalRefundAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
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
      refunds,
      rowIndex: item.rowIndex,
      warnings: item.warnings || []
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
        refundIndex: idx + 1,
        orderRowIndex: o.rowIndex,
        refundRowIndex: r.rowIndex
      });
    });
  });

  return {
    summary: {
      generatedAt: new Date().toISOString(),
      totalOrders: orderDetails.length,
      totalUniqueOrders: uniqueOrders.length,
      totalDuplicateOrders: duplicates.length,
      totalLeaders: leaderCommission.length,
      totalSales,
      totalRefunds,
      totalNetSales,
      totalCommission,
      totalPlatformFees,
      platformFeeRate,
      errorCount: allErrors.length,
      warningCount: allWarnings.length
    },
    orderDetails,
    leaderCommission,
    refundOffsets,
    errors: allErrors,
    warnings: allWarnings,
    duplicates
  };
}
