import {
  ReconciliationResult,
  ComparisonResult,
  LoadedData,
  Config
} from './types';
import { reconcileData } from './reconciler';
import { calculatePercentageChange, roundTo } from './utils';

export function comparePeriods(
  data: LoadedData,
  basePeriod: { startDate: string; endDate: string; stallId?: string },
  comparePeriod: { startDate: string; endDate: string; stallId?: string }
): ComparisonResult {
  const baseReconciliation = reconcileData(data, {
    startDate: basePeriod.startDate,
    endDate: basePeriod.endDate,
    stallId: basePeriod.stallId
  });
  
  const compareReconciliation = reconcileData(data, {
    startDate: comparePeriod.startDate,
    endDate: comparePeriod.endDate,
    stallId: comparePeriod.stallId
  });
  
  return buildComparisonResult(
    baseReconciliation,
    compareReconciliation,
    basePeriod,
    comparePeriod,
    data.config
  );
}

export function compareStalls(
  data: LoadedData,
  baseStallId: string,
  compareStallId: string,
  options: { startDate?: string; endDate?: string } = {}
): ComparisonResult {
  const baseReconciliation = reconcileData(data, {
    startDate: options.startDate,
    endDate: options.endDate,
    stallId: baseStallId
  });
  
  const compareReconciliation = reconcileData(data, {
    startDate: options.startDate,
    endDate: options.endDate,
    stallId: compareStallId
  });
  
  return buildComparisonResult(
    baseReconciliation,
    compareReconciliation,
    {
      startDate: baseReconciliation.period.startDate,
      endDate: baseReconciliation.period.endDate,
      stallId: baseStallId
    },
    {
      startDate: compareReconciliation.period.startDate,
      endDate: compareReconciliation.period.endDate,
      stallId: compareStallId
    },
    data.config
  );
}

function buildComparisonResult(
  base: ReconciliationResult,
  compare: ReconciliationResult,
  basePeriod: { startDate: string; endDate: string; stallId?: string },
  comparePeriod: { startDate: string; endDate: string; stallId?: string },
  config: Config
): ComparisonResult {
  const baseOverall = base.overall;
  const compareOverall = compare.overall;
  
  const revenueChange = compareOverall.totalRevenue - baseOverall.totalRevenue;
  const revenueChangePercent = calculatePercentageChange(baseOverall.totalRevenue, compareOverall.totalRevenue);
  
  const costChange = compareOverall.totalCost - baseOverall.totalCost;
  const costChangePercent = calculatePercentageChange(baseOverall.totalCost, compareOverall.totalCost);
  
  const profitChange = compareOverall.netProfit - baseOverall.netProfit;
  const profitChangePercent = calculatePercentageChange(baseOverall.netProfit, compareOverall.netProfit);
  
  const marginChange = compareOverall.profitMargin - baseOverall.profitMargin;
  
  const byStall: ComparisonResult['differences']['byStall'] = {};
  const allStallIds = new Set([
    ...Object.keys(base.byStall),
    ...Object.keys(compare.byStall)
  ]);
  
  for (const stallId of allStallIds) {
    const baseStall = base.byStall[stallId];
    const compareStall = compare.byStall[stallId];
    
    if (baseStall || compareStall) {
      const baseRevenue = baseStall?.totalRevenue || 0;
      const compareRevenue = compareStall?.totalRevenue || 0;
      const baseProfit = baseStall?.netProfit || 0;
      const compareProfit = compareStall?.netProfit || 0;
      
      byStall[stallId] = {
        stallName: compareStall?.stallName || baseStall?.stallName || stallId,
        revenueChange: roundTo(compareRevenue - baseRevenue),
        revenueChangePercent: roundTo(calculatePercentageChange(baseRevenue, compareRevenue), 4),
        profitChange: roundTo(compareProfit - baseProfit),
        profitChangePercent: roundTo(calculatePercentageChange(baseProfit, compareProfit), 4)
      };
    }
  }
  
  const byProduct: ComparisonResult['differences']['byProduct'] = {};
  const allProductIds = new Set([
    ...Object.keys(base.byProduct),
    ...Object.keys(compare.byProduct)
  ]);
  
  for (const productId of allProductIds) {
    const baseProduct = base.byProduct[productId];
    const compareProduct = compare.byProduct[productId];
    
    if (baseProduct || compareProduct) {
      const baseQuantity = baseProduct?.totalQuantitySold || 0;
      const compareQuantity = compareProduct?.totalQuantitySold || 0;
      const baseRevenue = baseProduct?.totalRevenue || 0;
      const compareRevenue = compareProduct?.totalRevenue || 0;
      const baseProfit = baseProduct?.netProfit || 0;
      const compareProfit = compareProduct?.netProfit || 0;
      
      byProduct[productId] = {
        productName: compareProduct?.productName || baseProduct?.productName || productId,
        quantityChange: compareQuantity - baseQuantity,
        quantityChangePercent: roundTo(calculatePercentageChange(baseQuantity, compareQuantity), 4),
        revenueChange: roundTo(compareRevenue - baseRevenue),
        revenueChangePercent: roundTo(calculatePercentageChange(baseRevenue, compareRevenue), 4),
        profitChange: roundTo(compareProfit - baseProfit),
        profitChangePercent: roundTo(calculatePercentageChange(baseProfit, compareProfit), 4)
      };
    }
  }
  
  const insights = generateInsights(base, compare, config);
  
  return {
    basePeriod: {
      startDate: basePeriod.startDate,
      endDate: basePeriod.endDate,
      reconciliation: base
    },
    comparePeriod: {
      startDate: comparePeriod.startDate,
      endDate: comparePeriod.endDate,
      reconciliation: compare
    },
    differences: {
      revenue: {
        base: roundTo(baseOverall.totalRevenue),
        compare: roundTo(compareOverall.totalRevenue),
        absoluteChange: roundTo(revenueChange),
        percentageChange: roundTo(revenueChangePercent, 4)
      },
      cost: {
        base: roundTo(baseOverall.totalCost),
        compare: roundTo(compareOverall.totalCost),
        absoluteChange: roundTo(costChange),
        percentageChange: roundTo(costChangePercent, 4)
      },
      netProfit: {
        base: roundTo(baseOverall.netProfit),
        compare: roundTo(compareOverall.netProfit),
        absoluteChange: roundTo(profitChange),
        percentageChange: roundTo(profitChangePercent, 4)
      },
      profitMargin: {
        base: roundTo(baseOverall.profitMargin, 4),
        compare: roundTo(compareOverall.profitMargin, 4),
        absoluteChange: roundTo(marginChange, 4)
      },
      byStall,
      byProduct
    },
    insights
  };
}

function generateInsights(
  base: ReconciliationResult,
  compare: ReconciliationResult,
  config: Config
): string[] {
  const insights: string[] = [];
  const { formatCurrency, formatPercentage } = require('./utils');
  
  const revenueChange = compare.overall.totalRevenue - base.overall.totalRevenue;
  const profitChange = compare.overall.netProfit - base.overall.netProfit;
  const marginChange = compare.overall.profitMargin - base.overall.profitMargin;
  
  if (revenueChange > 0) {
    insights.push(`📈 营收增长 ${formatCurrency(revenueChange, config)}，表现良好！`);
  } else if (revenueChange < 0) {
    insights.push(`📉 营收下降 ${formatCurrency(Math.abs(revenueChange), config)}，需要关注销售情况。`);
  }
  
  if (profitChange > 0 && revenueChange > 0) {
    if (marginChange > 0) {
      insights.push(`✨ 利润增长 ${formatCurrency(profitChange, config)}，同时利润率提升 ${formatPercentage(marginChange)}，经营效率提升！`);
    } else {
      insights.push(`💡 利润增长 ${formatCurrency(profitChange, config)}，但利润率下降 ${formatPercentage(Math.abs(marginChange))}，成本控制需要加强。`);
    }
  } else if (profitChange < 0) {
    if (revenueChange < 0) {
      insights.push(`⚠️ 营收和利润双双下滑，建议分析原因并调整策略。`);
    } else {
      insights.push(`⚠️ 营收增长但利润下降 ${formatCurrency(Math.abs(profitChange), config)}，成本增长过快，需要重点关注成本控制。`);
    }
  }
  
  const topProducts = Object.entries(compare.byProduct)
    .sort((a, b) => b[1].netProfit - a[1].netProfit)
    .slice(0, 3);
  
  if (topProducts.length > 0) {
    const topProductNames = topProducts.map(([_, p]) => p.productName).join('、');
    insights.push(`🏆 最赚钱的商品: ${topProductNames}`);
  }
  
  const productsWithDecline: string[] = [];
  for (const [productId, compareProduct] of Object.entries(compare.byProduct)) {
    const baseProduct = base.byProduct[productId];
    if (baseProduct && compareProduct.netProfit < baseProduct.netProfit) {
      productsWithDecline.push(compareProduct.productName);
    }
  }
  
  if (productsWithDecline.length > 0) {
    const declineProductNames = productsWithDecline.slice(0, 3).join('、');
    insights.push(`📉 利润下滑的商品: ${declineProductNames}，建议分析原因。`);
  }
  
  const stallsWithGrowth: string[] = [];
  const stallsWithDecline: string[] = [];
  
  for (const [stallId, compareStall] of Object.entries(compare.byStall)) {
    const baseStall = base.byStall[stallId];
    if (baseStall) {
      if (compareStall.netProfit > baseStall.netProfit) {
        stallsWithGrowth.push(compareStall.stallName);
      } else if (compareStall.netProfit < baseStall.netProfit) {
        stallsWithDecline.push(compareStall.stallName);
      }
    }
  }
  
  if (stallsWithGrowth.length > 0) {
    const growthStallNames = stallsWithGrowth.join('、');
    insights.push(`🌟 利润增长的摊位: ${growthStallNames}`);
  }
  
  if (stallsWithDecline.length > 0) {
    const declineStallNames = stallsWithDecline.join('、');
    insights.push(`💧 利润下滑的摊位: ${declineStallNames}，需要关注经营情况。`);
  }
  
  const compareActionItems = compare.actionItems;
  const baseActionItems = base.actionItems;
  
  if (compareActionItems.length > baseActionItems.length) {
    insights.push(`⚠️ 待办事项增加了 ${compareActionItems.length - baseActionItems.length} 项，建议优先处理。`);
  } else if (compareActionItems.length < baseActionItems.length) {
    insights.push(`✅ 待办事项减少了 ${baseActionItems.length - compareActionItems.length} 项，经营状况改善！`);
  }
  
  return insights;
}

export function formatComparisonResult(result: ComparisonResult, config: Config): string {
  const lines: string[] = [];
  const { formatCurrency, formatPercentage } = require('./utils');
  
  lines.push('='.repeat(80));
  lines.push('📊 对比分析报告');
  lines.push('='.repeat(80));
  
  lines.push(`\n📅 基准期: ${result.basePeriod.startDate} 至 ${result.basePeriod.endDate}`);
  lines.push(`📅 对比期: ${result.comparePeriod.startDate} 至 ${result.comparePeriod.endDate}`);
  
  lines.push('\n' + '─'.repeat(80));
  lines.push('💰 核心指标对比');
  lines.push('─'.repeat(80));
  
  const diff = result.differences;
  
  lines.push('\n   ' + padRight('指标', 20) + 
    padRight('基准期', 18) + 
    padRight('对比期', 18) + 
    padRight('变化额', 18) + 
    '变化率');
  
  const revenueChangeStr = diff.revenue.absoluteChange >= 0 ? '+' : '';
  const revenueChangePercentStr = diff.revenue.percentageChange >= 0 ? '+' : '';
  
  lines.push('   ' + padRight('总营收', 20) +
    padRight(formatCurrency(diff.revenue.base, config), 18) +
    padRight(formatCurrency(diff.revenue.compare, config), 18) +
    padRight(revenueChangeStr + formatCurrency(diff.revenue.absoluteChange, config), 18) +
    revenueChangePercentStr + formatPercentage(diff.revenue.percentageChange));
  
  const costChangeStr = diff.cost.absoluteChange >= 0 ? '+' : '';
  const costChangePercentStr = diff.cost.percentageChange >= 0 ? '+' : '';
  
  lines.push('   ' + padRight('总成本', 20) +
    padRight(formatCurrency(diff.cost.base, config), 18) +
    padRight(formatCurrency(diff.cost.compare, config), 18) +
    padRight(costChangeStr + formatCurrency(diff.cost.absoluteChange, config), 18) +
    costChangePercentStr + formatPercentage(diff.cost.percentageChange));
  
  const profitChangeStr = diff.netProfit.absoluteChange >= 0 ? '+' : '';
  const profitChangePercentStr = diff.netProfit.percentageChange >= 0 ? '+' : '';
  
  lines.push('   ' + padRight('净利润', 20) +
    padRight(formatCurrency(diff.netProfit.base, config), 18) +
    padRight(formatCurrency(diff.netProfit.compare, config), 18) +
    padRight(profitChangeStr + formatCurrency(diff.netProfit.absoluteChange, config), 18) +
    profitChangePercentStr + formatPercentage(diff.netProfit.percentageChange));
  
  const marginChangeStr = diff.profitMargin.absoluteChange >= 0 ? '+' : '';
  
  lines.push('   ' + padRight('利润率', 20) +
    padRight(formatPercentage(diff.profitMargin.base), 18) +
    padRight(formatPercentage(diff.profitMargin.compare), 18) +
    padRight(marginChangeStr + formatPercentage(diff.profitMargin.absoluteChange), 18) +
    '-');
  
  if (Object.keys(diff.byStall).length > 0) {
    lines.push('\n' + '─'.repeat(80));
    lines.push('🏪 摊位对比');
    lines.push('─'.repeat(80));
    
    lines.push('\n   ' + padRight('摊位', 20) +
      padRight('营收变化', 18) +
      padRight('营收变化率', 18) +
      padRight('利润变化', 18) +
      '利润变化率');
    
    Object.entries(diff.byStall).forEach(([stallId, stall]) => {
      const revChangeStr = stall.revenueChange >= 0 ? '+' : '';
      const revChangePercentStr = stall.revenueChangePercent >= 0 ? '+' : '';
      const profitChangeStr = stall.profitChange >= 0 ? '+' : '';
      const profitChangePercentStr = stall.profitChangePercent >= 0 ? '+' : '';
      
      lines.push('   ' + padRight(stall.stallName, 20) +
        padRight(revChangeStr + formatCurrency(stall.revenueChange, config), 18) +
        padRight(revChangePercentStr + formatPercentage(stall.revenueChangePercent), 18) +
        padRight(profitChangeStr + formatCurrency(stall.profitChange, config), 18) +
        profitChangePercentStr + formatPercentage(stall.profitChangePercent));
    });
  }
  
  if (Object.keys(diff.byProduct).length > 0) {
    lines.push('\n' + '─'.repeat(80));
    lines.push('📦 商品对比 (TOP 10)');
    lines.push('─'.repeat(80));
    
    const sortedProducts = Object.entries(diff.byProduct)
      .sort((a, b) => Math.abs(b[1].profitChange) - Math.abs(a[1].profitChange))
      .slice(0, 10);
    
    lines.push('\n   ' + padRight('商品', 25) +
      padRight('销量变化', 12) +
      padRight('营收变化', 18) +
      padRight('利润变化', 18) +
      '利润率变化');
    
    sortedProducts.forEach(([productId, product]) => {
      const qtyChangeStr = product.quantityChange >= 0 ? '+' : '';
      const revChangeStr = product.revenueChange >= 0 ? '+' : '';
      const profitChangeStr = product.profitChange >= 0 ? '+' : '';
      const profitChangePercentStr = product.profitChangePercent >= 0 ? '+' : '';
      
      lines.push('   ' + padRight(truncate(product.productName, 24), 25) +
        padRight(qtyChangeStr + product.quantityChange, 12) +
        padRight(revChangeStr + formatCurrency(product.revenueChange, config), 18) +
        padRight(profitChangeStr + formatCurrency(product.profitChange, config), 18) +
        profitChangePercentStr + formatPercentage(product.profitChangePercent));
    });
  }
  
  if (result.insights.length > 0) {
    lines.push('\n' + '─'.repeat(80));
    lines.push('💡 分析洞察');
    lines.push('─'.repeat(80));
    
    result.insights.forEach((insight, index) => {
      lines.push(`\n   ${index + 1}. ${insight}`);
    });
  }
  
  lines.push('\n' + '='.repeat(80));
  
  return lines.join('\n');
}

function padRight(str: string, length: number): string {
  return str.padEnd(length, ' ');
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
