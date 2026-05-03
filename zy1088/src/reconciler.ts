import {
  Sale,
  Payment,
  Inventory,
  InventoryItem,
  InventoryRecord,
  Fee,
  Return,
  Config,
  LoadedData,
  DailyProfit,
  ReconciliationResult,
  ActionItem,
  ValidationError
} from './types';
import { groupBy, sumBy, roundTo, isDateInRange, getBusinessDate } from './utils';

export function reconcileData(
  data: LoadedData,
  options: {
    startDate?: string;
    endDate?: string;
    stallId?: string;
  } = {}
): ReconciliationResult {
  const { sales, payments, inventory, fees, returns, config } = data;
  const { startDate, endDate, stallId } = options;
  
  let filteredSales = sales;
  let filteredPayments = payments;
  let filteredFees = fees;
  let filteredReturns = returns;
  let filteredInventoryRecords = inventory.records;
  
  if (startDate || endDate) {
    filteredSales = sales.filter(s => isDateInRange(getBusinessDate(s.timestamp, config), startDate, endDate));
    filteredPayments = payments.filter(p => isDateInRange(getBusinessDate(p.timestamp, config), startDate, endDate));
    filteredFees = fees.filter(f => isDateInRange(f.date, startDate, endDate));
    filteredReturns = returns.filter(r => isDateInRange(getBusinessDate(r.timestamp, config), startDate, endDate));
    filteredInventoryRecords = inventory.records.filter(r => isDateInRange(getBusinessDate(r.timestamp, config), startDate, endDate));
  }
  
  if (stallId) {
    filteredSales = filteredSales.filter(s => s.stallId === stallId);
    filteredPayments = filteredPayments.filter(p => p.stallId === stallId);
    filteredFees = filteredFees.filter(f => f.stallId === stallId);
    filteredReturns = filteredReturns.filter(r => r.stallId === stallId);
    filteredInventoryRecords = filteredInventoryRecords.filter(r => r.stallId === stallId);
  }
  
  const uniqueDates = new Set<string>();
  filteredSales.forEach(s => uniqueDates.add(getBusinessDate(s.timestamp, config)));
  filteredPayments.forEach(p => uniqueDates.add(getBusinessDate(p.timestamp, config)));
  filteredFees.forEach(f => uniqueDates.add(f.date));
  filteredReturns.forEach(r => uniqueDates.add(getBusinessDate(r.timestamp, config)));
  
  const dates = Array.from(uniqueDates).sort();
  const stallIds = Array.from(new Set(filteredSales.map(s => s.stallId)));
  
  if (stallIds.length === 0) {
    stallIds.push(config.stallIds[0] || 'stall-001');
  }
  
  const dailySummary: DailyProfit[] = [];
  
  for (const date of dates) {
    for (const sid of stallIds) {
      const dailyProfit = calculateDailyProfit(
        date,
        sid,
        filteredSales.filter(s => getBusinessDate(s.timestamp, config) === date && s.stallId === sid),
        filteredPayments.filter(p => getBusinessDate(p.timestamp, config) === date && p.stallId === sid),
        filteredReturns.filter(r => getBusinessDate(r.timestamp, config) === date && r.stallId === sid),
        filteredFees.filter(f => f.date === date && f.stallId === sid),
        filteredInventoryRecords.filter(r => getBusinessDate(r.timestamp, config) === date && r.stallId === sid),
        inventory.items,
        config
      );
      dailySummary.push(dailyProfit);
    }
  }
  
  const overall = calculateOverallSummary(dailySummary);
  const byStall = calculateByStallSummary(dailySummary, config);
  const byProduct = calculateByProductSummary(filteredSales, filteredReturns, inventory.items, config);
  const actionItems = generateActionItems(filteredSales, filteredPayments, filteredReturns, filteredFees, inventory, config);
  const issues = detectReconciliationIssues(filteredSales, filteredPayments, filteredReturns, inventory, config);
  
  return {
    period: {
      startDate: dates[0] || '',
      endDate: dates[dates.length - 1] || ''
    },
    dailySummary,
    overall,
    byStall,
    byProduct,
    issues,
    actionItems
  };
}

function calculateDailyProfit(
  date: string,
  stallId: string,
  sales: Sale[],
  payments: Payment[],
  returns: Return[],
  fees: Fee[],
  inventoryRecords: InventoryRecord[],
  inventoryItems: InventoryItem[],
  config: Config
): DailyProfit {
  const productMap = new Map(inventoryItems.map(item => [item.productId, item]));
  const stallName = config.stallNames[stallId] || stallId;
  
  const salesByPaymentMethod: Record<string, number> = {};
  const salesByProduct: Record<string, { quantity: number; revenue: number; cost: number }> = {};
  
  sales.forEach(sale => {
    const method = sale.paymentMethod;
    salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + sale.totalAmount;
    
    const productKey = sale.productId;
    if (!salesByProduct[productKey]) {
      salesByProduct[productKey] = { quantity: 0, revenue: 0, cost: 0 };
    }
    salesByProduct[productKey].quantity += sale.quantity;
    salesByProduct[productKey].revenue += sale.totalAmount;
    
    const product = productMap.get(sale.productId);
    if (product) {
      salesByProduct[productKey].cost += sale.quantity * product.unitCost;
    }
  });
  
  const totalRevenue = sumBy(sales, s => s.totalAmount);
  const totalCostOfGoodsSold = Object.values(salesByProduct).reduce((sum, p) => sum + p.cost, 0);
  
  const returnsByProduct: Record<string, { quantity: number; refundAmount: number; cost: number }> = {};
  returns.forEach(ret => {
    const productKey = ret.productId;
    if (!returnsByProduct[productKey]) {
      returnsByProduct[productKey] = { quantity: 0, refundAmount: 0, cost: 0 };
    }
    returnsByProduct[productKey].quantity += ret.quantity;
    returnsByProduct[productKey].refundAmount += ret.refundAmount;
    
    const product = productMap.get(ret.productId);
    if (product) {
      returnsByProduct[productKey].cost += ret.quantity * product.unitCost;
    }
  });
  
  const totalReturnsRefund = sumBy(returns, r => r.refundAmount);
  const totalReturnsCost = Object.values(returnsByProduct).reduce((sum, r) => sum + r.cost, 0);
  
  const damageRecords = inventoryRecords.filter(r => r.type === 'damage');
  const damagesByProduct: Record<string, { quantity: number; cost: number }> = {};
  damageRecords.forEach(record => {
    const productKey = record.productId;
    if (!damagesByProduct[productKey]) {
      damagesByProduct[productKey] = { quantity: 0, cost: 0 };
    }
    damagesByProduct[productKey].quantity += record.quantity;
    damagesByProduct[productKey].cost += record.totalCost;
  });
  
  const totalDamagesCost = sumBy(damageRecords, r => r.totalCost);
  
  const feesByType: Record<string, number> = {};
  let rentalFee = 0;
  let utilityFee = 0;
  let cleaningFee = 0;
  let marketingFee = 0;
  
  fees.forEach(fee => {
    feesByType[fee.type] = (feesByType[fee.type] || 0) + fee.amount;
    switch (fee.type) {
      case 'rental': rentalFee += fee.amount; break;
      case 'utility': utilityFee += fee.amount; break;
      case 'cleaning': cleaningFee += fee.amount; break;
      case 'marketing': marketingFee += fee.amount; break;
    }
  });
  
  if (rentalFee === 0) {
    rentalFee = config.fees.defaultRentalFee;
    feesByType['rental'] = (feesByType['rental'] || 0) + rentalFee;
  }
  if (utilityFee === 0) {
    utilityFee = config.fees.utilityFeePerDay;
    feesByType['utility'] = (feesByType['utility'] || 0) + utilityFee;
  }
  
  const totalFees = Object.values(feesByType).reduce((sum, f) => sum + f, 0);
  
  const platformFeesByMethod: Record<string, number> = {};
  let totalPlatformFees = 0;
  
  sales.forEach(sale => {
    const method = sale.paymentMethod;
    const feeRate = config.platformFees[method] || 0;
    const fee = sale.totalAmount * feeRate;
    platformFeesByMethod[method] = (platformFeesByMethod[method] || 0) + fee;
    totalPlatformFees += fee;
  });
  
  const taxableRevenue = Math.max(0, totalRevenue - totalReturnsRefund);
  let estimatedTax = 0;
  if (config.taxes.enabled && taxableRevenue > config.taxes.threshold) {
    estimatedTax = taxableRevenue * config.taxes.rate;
  }
  
  const grossProfit = totalRevenue - totalReturnsRefund - totalCostOfGoodsSold;
  const operatingProfit = grossProfit - totalDamagesCost - totalFees - totalPlatformFees;
  const netProfit = operatingProfit - estimatedTax;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
  
  return {
    date,
    stallId,
    stallName,
    sales: {
      totalOrders: sales.length,
      totalQuantity: sumBy(sales, s => s.quantity),
      grossRevenue: roundTo(totalRevenue),
      byPaymentMethod: salesByPaymentMethod,
      byProduct: salesByProduct
    },
    costs: {
      costOfGoodsSold: roundTo(totalCostOfGoodsSold),
      byProduct: Object.fromEntries(
        Object.entries(salesByProduct).map(([k, v]) => [k, v.cost])
      )
    },
    returns: {
      totalReturns: returns.length,
      totalQuantity: sumBy(returns, r => r.quantity),
      totalRefundAmount: roundTo(totalReturnsRefund),
      returnedCost: roundTo(totalReturnsCost),
      byProduct: returnsByProduct
    },
    damages: {
      totalItems: sumBy(damageRecords, r => r.quantity),
      totalCost: roundTo(totalDamagesCost),
      byProduct: damagesByProduct
    },
    fees: {
      totalFees: roundTo(totalFees),
      byType: feesByType,
      rentalFee: roundTo(rentalFee),
      utilityFee: roundTo(utilityFee),
      cleaningFee: roundTo(cleaningFee),
      marketingFee: roundTo(marketingFee)
    },
    platformFees: {
      totalFees: roundTo(totalPlatformFees),
      byMethod: platformFeesByMethod
    },
    taxes: {
      estimatedTax: roundTo(estimatedTax),
      taxableAmount: roundTo(taxableRevenue)
    },
    profit: {
      grossProfit: roundTo(grossProfit),
      operatingProfit: roundTo(operatingProfit),
      netProfit: roundTo(netProfit),
      profitMargin: roundTo(profitMargin, 4)
    }
  };
}

function calculateOverallSummary(dailySummary: DailyProfit[]): ReconciliationResult['overall'] {
  const totalRevenue = sumBy(dailySummary, d => d.sales.grossRevenue);
  const totalCost = sumBy(dailySummary, d => d.costs.costOfGoodsSold);
  const totalReturns = sumBy(dailySummary, d => d.returns.totalRefundAmount);
  const totalDamages = sumBy(dailySummary, d => d.damages.totalCost);
  const totalFees = sumBy(dailySummary, d => d.fees.totalFees);
  const totalPlatformFees = sumBy(dailySummary, d => d.platformFees.totalFees);
  const totalTaxes = sumBy(dailySummary, d => d.taxes.estimatedTax);
  
  const grossProfit = totalRevenue - totalReturns - totalCost;
  const netProfit = grossProfit - totalDamages - totalFees - totalPlatformFees - totalTaxes;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
  
  return {
    totalRevenue: roundTo(totalRevenue),
    totalCost: roundTo(totalCost),
    totalReturns: roundTo(totalReturns),
    totalDamages: roundTo(totalDamages),
    totalFees: roundTo(totalFees),
    totalPlatformFees: roundTo(totalPlatformFees),
    totalTaxes: roundTo(totalTaxes),
    grossProfit: roundTo(grossProfit),
    netProfit: roundTo(netProfit),
    profitMargin: roundTo(profitMargin, 4)
  };
}

function calculateByStallSummary(
  dailySummary: DailyProfit[],
  config: Config
): ReconciliationResult['byStall'] {
  const result: ReconciliationResult['byStall'] = {};
  
  const byStall = groupBy(dailySummary, d => d.stallId);
  
  for (const [stallId, dailyData] of Object.entries(byStall)) {
    const totalRevenue = sumBy(dailyData, d => d.sales.grossRevenue);
    const totalCost = sumBy(dailyData, d => d.costs.costOfGoodsSold);
    const netProfit = sumBy(dailyData, d => d.profit.netProfit);
    const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
    
    result[stallId] = {
      stallName: config.stallNames[stallId] || stallId,
      totalRevenue: roundTo(totalRevenue),
      totalCost: roundTo(totalCost),
      netProfit: roundTo(netProfit),
      profitMargin: roundTo(profitMargin, 4),
      dailyData
    };
  }
  
  return result;
}

function calculateByProductSummary(
  sales: Sale[],
  returns: Return[],
  inventoryItems: InventoryItem[],
  config: Config
): ReconciliationResult['byProduct'] {
  const result: ReconciliationResult['byProduct'] = {};
  const productMap = new Map(inventoryItems.map(item => [item.productId, item]));
  
  const salesByProduct = groupBy(sales, s => s.productId);
  const returnsByProduct = groupBy(returns, r => r.productId);
  
  const allProductIds = new Set([
    ...Object.keys(salesByProduct),
    ...Object.keys(returnsByProduct)
  ]);
  
  for (const productId of allProductIds) {
    const productSales = salesByProduct[productId] || [];
    const productReturns = returnsByProduct[productId] || [];
    const product = productMap.get(productId);
    
    const totalQuantitySold = sumBy(productSales, s => s.quantity);
    const totalQuantityReturned = sumBy(productReturns, r => r.quantity);
    const totalRevenue = sumBy(productSales, s => s.totalAmount) - sumBy(productReturns, r => r.refundAmount);
    
    const unitCost = product?.unitCost || 0;
    const totalCost = (totalQuantitySold - totalQuantityReturned) * unitCost;
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
    
    result[productId] = {
      productName: product?.productName || productSales[0]?.productName || productId,
      category: product?.category || 'uncategorized',
      totalQuantitySold,
      totalQuantityReturned,
      totalRevenue: roundTo(totalRevenue),
      totalCost: roundTo(totalCost),
      netProfit: roundTo(netProfit),
      profitMargin: roundTo(profitMargin, 4)
    };
  }
  
  return result;
}

function generateActionItems(
  sales: Sale[],
  payments: Payment[],
  returns: Return[],
  fees: Fee[],
  inventory: Inventory,
  config: Config
): ActionItem[] {
  const actionItems: ActionItem[] = [];
  
  const salesWithPaymentId = sales.filter(s => s.paymentId);
  const paymentIds = new Set(payments.map(p => p.paymentId));
  const missingPayments = salesWithPaymentId.filter(s => !paymentIds.has(s.paymentId!));
  
  if (missingPayments.length > 0) {
    actionItems.push({
      priority: 'high',
      category: 'payment',
      description: `发现 ${missingPayments.length} 笔销售缺少对应的收款记录`,
      impact: '这些销售可能尚未收到款项，或收款记录未录入，直接影响实际收入',
      suggestedAction: '核对销售记录和收款记录，补充缺失的收款记录',
      relatedRecords: missingPayments.map(s => s.orderId)
    });
  }
  
  const paymentsWithOrderId = payments.filter(p => p.orderId && p.status === 'success');
  const orderIds = new Set(sales.map(s => s.orderId));
  const orphanPayments = paymentsWithOrderId.filter(p => !orderIds.has(p.orderId!));
  
  if (orphanPayments.length > 0) {
    actionItems.push({
      priority: 'medium',
      category: 'payment',
      description: `发现 ${orphanPayments.length} 笔收款没有对应的销售订单`,
      impact: '可能是销售记录遗漏，或订单号输入错误',
      suggestedAction: '检查这些收款对应的销售是否已记录，或修正订单号',
      relatedRecords: orphanPayments.map(p => p.paymentId)
    });
  }
  
  const returnsWithoutOrder = returns.filter(r => !r.originalOrderId);
  if (returnsWithoutOrder.length > 0) {
    actionItems.push({
      priority: 'high',
      category: 'return',
      description: `发现 ${returnsWithoutOrder.length} 笔退货缺少原订单号`,
      impact: '无法确认退货的合法性，可能导致错误退款',
      suggestedAction: '补充原订单号，或删除无效的退货记录',
      relatedRecords: returnsWithoutOrder.map(r => r.returnId)
    });
  }
  
  const productMap = new Map(inventory.items.map(item => [item.productId, item]));
  const salesByProduct = groupBy(sales, s => s.productId);
  const returnsByProduct = groupBy(returns, r => r.productId);
  
  const negativeStockProducts: string[] = [];
  for (const item of inventory.items) {
    const sold = sumBy(salesByProduct[item.productId] || [], s => s.quantity);
    const returned = sumBy(returnsByProduct[item.productId] || [], r => r.quantity);
    const remaining = item.initialStock - sold + returned;
    
    if (remaining < 0) {
      negativeStockProducts.push(`${item.productName}(${item.productId})`);
    }
  }
  
  if (negativeStockProducts.length > 0) {
    actionItems.push({
      priority: 'high',
      category: 'inventory',
      description: `发现 ${negativeStockProducts.length} 种商品库存可能为负数`,
      impact: '负库存表示销售超过了进货量，可能存在：1) 进货记录遗漏；2) 销售记录错误；3) 库存盘点不准确',
      suggestedAction: '核对进货记录、销售记录和实际库存，补充遗漏的进货或修正错误的销售',
      relatedRecords: negativeStockProducts
    });
  }
  
  const lowStockProducts = inventory.items.filter(item => item.currentStock <= item.minStock);
  if (lowStockProducts.length > 0) {
    actionItems.push({
      priority: 'low',
      category: 'inventory',
      description: `发现 ${lowStockProducts.length} 种商品库存低于最低库存预警线`,
      impact: '可能导致销售机会流失',
      suggestedAction: '考虑补货',
      relatedRecords: lowStockProducts.map(p => `${p.productName}(${p.productId})`)
    });
  }
  
  const unprofitableProducts = inventory.items.filter(item => item.unitPrice < item.unitCost);
  if (unprofitableProducts.length > 0) {
    actionItems.push({
      priority: 'medium',
      category: 'inventory',
      description: `发现 ${unprofitableProducts.length} 种商品售价低于成本`,
      impact: '每卖出一件都会亏损',
      suggestedAction: '考虑调整售价或寻找更低成本的进货渠道',
      relatedRecords: unprofitableProducts.map(p => `${p.productName}(${p.productId})`)
    });
  }
  
  return actionItems;
}

function detectReconciliationIssues(
  sales: Sale[],
  payments: Payment[],
  returns: Return[],
  inventory: Inventory,
  config: Config
): ValidationError[] {
  const issues: ValidationError[] = [];
  
  const salesByOrderId = groupBy(sales, s => s.orderId);
  
  for (const payment of payments) {
    if (payment.orderId && payment.status === 'success') {
      const relatedSales = salesByOrderId[payment.orderId] || [];
      if (relatedSales.length > 0) {
        const totalSaleAmount = sumBy(relatedSales, s => s.totalAmount);
        if (Math.abs(payment.amount - totalSaleAmount) > 0.01) {
          issues.push({
            type: 'payment_mismatch',
            severity: 'error',
            message: `订单 ${payment.orderId}: 销售金额 ${totalSaleAmount} 与收款金额 ${payment.amount} 不符`,
            impactOnProfit: '金额不一致会导致实际收入与账面不符，差异金额为 ' +
              (payment.amount > totalSaleAmount 
                ? `多收了 ${payment.amount - totalSaleAmount}` 
                : `少收了 ${totalSaleAmount - payment.amount}`),
            actionRequired: '核对销售记录和收款记录，找出差异原因并修正',
            details: {
              orderId: payment.orderId,
              paymentId: payment.paymentId,
              value: payment.amount,
              expected: totalSaleAmount
            }
          });
        }
      }
    }
  }
  
  return issues;
}

export function formatReconciliationResult(result: ReconciliationResult, config: Config): string {
  const lines: string[] = [];
  const { formatCurrency, formatPercentage } = require('./utils');
  
  lines.push('='.repeat(70));
  lines.push('📊 对账报告');
  lines.push('='.repeat(70));
  
  if (result.period.startDate && result.period.endDate) {
    lines.push(`\n📅 统计周期: ${result.period.startDate} 至 ${result.period.endDate}`);
  }
  
  lines.push('\n' + '─'.repeat(70));
  lines.push('💰 总体概况');
  lines.push('─'.repeat(70));
  
  const overall = result.overall;
  lines.push(`\n   总营收: ${formatCurrency(overall.totalRevenue, config)}`);
  lines.push(`   总成本: ${formatCurrency(overall.totalCost, config)}`);
  lines.push(`   总退款: ${formatCurrency(overall.totalReturns, config)}`);
  lines.push(`   总损耗: ${formatCurrency(overall.totalDamages, config)}`);
  lines.push(`   总费用: ${formatCurrency(overall.totalFees, config)}`);
  lines.push(`   平台手续费: ${formatCurrency(overall.totalPlatformFees, config)}`);
  lines.push(`   预估税费: ${formatCurrency(overall.totalTaxes, config)}`);
  lines.push(`\n   ✨ 毛利润: ${formatCurrency(overall.grossProfit, config)}`);
  lines.push(`   🌟 净利润: ${formatCurrency(overall.netProfit, config)}`);
  lines.push(`   📈 利润率: ${formatPercentage(overall.profitMargin)}`);
  
  if (result.dailySummary.length > 0) {
    lines.push('\n' + '─'.repeat(70));
    lines.push('📆 每日明细');
    lines.push('─'.repeat(70));
    
    result.dailySummary.forEach(daily => {
      lines.push(`\n【${daily.date} - ${daily.stallName}】`);
      lines.push(`   订单数: ${daily.sales.totalOrders}  |  销量: ${daily.sales.totalQuantity}  |  营收: ${formatCurrency(daily.sales.grossRevenue, config)}`);
      lines.push(`   成本: ${formatCurrency(daily.costs.costOfGoodsSold, config)}  |  退款: ${formatCurrency(daily.returns.totalRefundAmount, config)}  |  损耗: ${formatCurrency(daily.damages.totalCost, config)}`);
      lines.push(`   费用: ${formatCurrency(daily.fees.totalFees, config)}  |  手续费: ${formatCurrency(daily.platformFees.totalFees, config)}  |  税费: ${formatCurrency(daily.taxes.estimatedTax, config)}`);
      lines.push(`   👉 净利润: ${formatCurrency(daily.profit.netProfit, config)} (${formatPercentage(daily.profit.profitMargin)})`);
    });
  }
  
  if (Object.keys(result.byProduct).length > 0) {
    lines.push('\n' + '─'.repeat(70));
    lines.push('📦 商品分析');
    lines.push('─'.repeat(70));
    
    const sortedProducts = Object.entries(result.byProduct).sort(
      (a, b) => b[1].netProfit - a[1].netProfit
    );
    
    sortedProducts.forEach(([productId, product]) => {
      lines.push(`\n【${product.productName}】(${product.category})`);
      lines.push(`   销量: ${product.totalQuantitySold}  |  退货: ${product.totalQuantityReturned}  |  净销量: ${product.totalQuantitySold - product.totalQuantityReturned}`);
      lines.push(`   营收: ${formatCurrency(product.totalRevenue, config)}  |  成本: ${formatCurrency(product.totalCost, config)}  |  利润: ${formatCurrency(product.netProfit, config)}`);
      lines.push(`   利润率: ${formatPercentage(product.profitMargin)}`);
    });
  }
  
  if (result.actionItems.length > 0) {
    lines.push('\n' + '─'.repeat(70));
    lines.push('⚠️ 待办事项');
    lines.push('─'.repeat(70));
    
    result.actionItems.forEach((item, index) => {
      const priorityIcon = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`\n${priorityIcon} [${index + 1}] ${item.description}`);
      lines.push(`   影响: ${item.impact}`);
      lines.push(`   建议: ${item.suggestedAction}`);
      if (item.relatedRecords.length > 0) {
        lines.push(`   相关记录: ${item.relatedRecords.slice(0, 5).join(', ')}${item.relatedRecords.length > 5 ? '...' : ''}`);
      }
    });
  }
  
  if (result.issues.length > 0) {
    lines.push('\n' + '─'.repeat(70));
    lines.push('❌ 对账问题 (需要立即处理)');
    lines.push('─'.repeat(70));
    
    result.issues.forEach((issue, index) => {
      lines.push(`\n[${index + 1}] ${issue.message}`);
      lines.push(`   💰 对利润的影响: ${issue.impactOnProfit}`);
      lines.push(`   👉 需要操作: ${issue.actionRequired}`);
    });
  }
  
  lines.push('\n' + '='.repeat(70));
  
  return lines.join('\n');
}
