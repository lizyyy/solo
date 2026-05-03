import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import {
  ReconciliationResult,
  ComparisonResult,
  ValidationResult,
  ExportOptions,
  Config
} from './types';
import { ensureDirectoryExists } from './utils';

export function exportReconciliation(
  result: ReconciliationResult,
  options: ExportOptions,
  config: Config
): string {
  ensureDirectoryExists(options.outputPath || config.output.exportDirectory);
  
  const baseFileName = options.fileName || `reconciliation-${result.period.startDate || 'all'}`;
  const outputDir = options.outputPath || config.output.exportDirectory;
  
  let content: string;
  let extension: string;
  
  switch (options.format) {
    case 'json':
      content = exportToJson(result, options);
      extension = 'json';
      break;
    case 'csv':
      content = exportReconciliationToCsv(result, options, config);
      extension = 'csv';
      break;
    case 'markdown':
    default:
      content = exportReconciliationToMarkdown(result, options, config);
      extension = 'md';
      break;
  }
  
  const filePath = path.join(outputDir, `${baseFileName}.${extension}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return filePath;
}

export function exportValidation(
  result: ValidationResult,
  options: ExportOptions,
  config: Config
): string {
  ensureDirectoryExists(options.outputPath || config.output.exportDirectory);
  
  const baseFileName = options.fileName || 'validation-result';
  const outputDir = options.outputPath || config.output.exportDirectory;
  
  let content: string;
  let extension: string;
  
  switch (options.format) {
    case 'json':
      content = JSON.stringify(result, null, 2);
      extension = 'json';
      break;
    case 'csv':
      content = exportValidationToCsv(result);
      extension = 'csv';
      break;
    case 'markdown':
    default:
      content = exportValidationToMarkdown(result);
      extension = 'md';
      break;
  }
  
  const filePath = path.join(outputDir, `${baseFileName}.${extension}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return filePath;
}

export function exportComparison(
  result: ComparisonResult,
  options: ExportOptions,
  config: Config
): string {
  ensureDirectoryExists(options.outputPath || config.output.exportDirectory);
  
  const baseFileName = options.fileName || `comparison-${result.basePeriod.startDate}-vs-${result.comparePeriod.startDate}`;
  const outputDir = options.outputPath || config.output.exportDirectory;
  
  let content: string;
  let extension: string;
  
  switch (options.format) {
    case 'json':
      content = JSON.stringify(result, null, 2);
      extension = 'json';
      break;
    case 'csv':
      content = exportComparisonToCsv(result, config);
      extension = 'csv';
      break;
    case 'markdown':
    default:
      content = exportComparisonToMarkdown(result, config);
      extension = 'md';
      break;
  }
  
  const filePath = path.join(outputDir, `${baseFileName}.${extension}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return filePath;
}

function exportToJson(result: ReconciliationResult, options: ExportOptions): string {
  const data: any = {
    period: result.period,
    overall: result.overall
  };
  
  if (options.includeDailyDetails) {
    data.dailySummary = result.dailySummary;
  }
  
  if (options.includeStallDetails) {
    data.byStall = result.byStall;
  }
  
  if (options.includeProductDetails) {
    data.byProduct = result.byProduct;
  }
  
  if (options.includeActionItems) {
    data.actionItems = result.actionItems;
  }
  
  if (options.includeIssues) {
    data.issues = result.issues;
  }
  
  return JSON.stringify(data, null, 2);
}

function exportReconciliationToMarkdown(
  result: ReconciliationResult,
  options: ExportOptions,
  config: Config
): string {
  const { formatCurrency, formatPercentage } = require('./utils');
  const lines: string[] = [];
  
  lines.push('# 夜市对账报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  if (result.period.startDate && result.period.endDate) {
    lines.push(`**统计周期**: ${result.period.startDate} 至 ${result.period.endDate}`);
  }
  lines.push('');
  
  lines.push('## 总体概况');
  lines.push('');
  lines.push('| 指标 | 金额 |');
  lines.push('|------|------|');
  lines.push(`| 总营收 | ${formatCurrency(result.overall.totalRevenue, config)} |`);
  lines.push(`| 总成本 | ${formatCurrency(result.overall.totalCost, config)} |`);
  lines.push(`| 总退款 | ${formatCurrency(result.overall.totalReturns, config)} |`);
  lines.push(`| 总损耗 | ${formatCurrency(result.overall.totalDamages, config)} |`);
  lines.push(`| 总费用 | ${formatCurrency(result.overall.totalFees, config)} |`);
  lines.push(`| 平台手续费 | ${formatCurrency(result.overall.totalPlatformFees, config)} |`);
  lines.push(`| 预估税费 | ${formatCurrency(result.overall.totalTaxes, config)} |`);
  lines.push(`| **毛利润** | **${formatCurrency(result.overall.grossProfit, config)}** |`);
  lines.push(`| **净利润** | **${formatCurrency(result.overall.netProfit, config)}** |`);
  lines.push(`| **利润率** | **${formatPercentage(result.overall.profitMargin)}** |`);
  lines.push('');
  
  if (options.includeDailyDetails && result.dailySummary.length > 0) {
    lines.push('## 每日明细');
    lines.push('');
    lines.push('| 日期 | 摊位 | 订单数 | 销量 | 营收 | 成本 | 退款 | 损耗 | 费用 | 净利润 | 利润率 |');
    lines.push('|------|------|--------|------|------|------|------|------|------|--------|--------|');
    
    result.dailySummary.forEach(daily => {
      lines.push(`| ${daily.date} | ${daily.stallName} | ${daily.sales.totalOrders} | ${daily.sales.totalQuantity} | ${formatCurrency(daily.sales.grossRevenue, config)} | ${formatCurrency(daily.costs.costOfGoodsSold, config)} | ${formatCurrency(daily.returns.totalRefundAmount, config)} | ${formatCurrency(daily.damages.totalCost, config)} | ${formatCurrency(daily.fees.totalFees, config)} | ${formatCurrency(daily.profit.netProfit, config)} | ${formatPercentage(daily.profit.profitMargin)} |`);
    });
    lines.push('');
  }
  
  if (options.includeStallDetails && Object.keys(result.byStall).length > 0) {
    lines.push('## 摊位分析');
    lines.push('');
    lines.push('| 摊位 | 总营收 | 总成本 | 净利润 | 利润率 |');
    lines.push('|------|--------|--------|--------|--------|');
    
    Object.entries(result.byStall).forEach(([stallId, stall]) => {
      lines.push(`| ${stall.stallName} | ${formatCurrency(stall.totalRevenue, config)} | ${formatCurrency(stall.totalCost, config)} | ${formatCurrency(stall.netProfit, config)} | ${formatPercentage(stall.profitMargin)} |`);
    });
    lines.push('');
  }
  
  if (options.includeProductDetails && Object.keys(result.byProduct).length > 0) {
    lines.push('## 商品分析');
    lines.push('');
    lines.push('| 商品 | 分类 | 销量 | 退货 | 营收 | 成本 | 利润 | 利润率 |');
    lines.push('|------|------|------|------|------|------|------|--------|');
    
    const sortedProducts = Object.entries(result.byProduct)
      .sort((a, b) => b[1].netProfit - a[1].netProfit);
    
    sortedProducts.forEach(([productId, product]) => {
      lines.push(`| ${product.productName} | ${product.category} | ${product.totalQuantitySold} | ${product.totalQuantityReturned} | ${formatCurrency(product.totalRevenue, config)} | ${formatCurrency(product.totalCost, config)} | ${formatCurrency(product.netProfit, config)} | ${formatPercentage(product.profitMargin)} |`);
    });
    lines.push('');
  }
  
  if (options.includeActionItems && result.actionItems.length > 0) {
    lines.push('## 待办事项');
    lines.push('');
    
    const priorityMap: Record<string, string> = {
      high: '🔴 高',
      medium: '🟡 中',
      low: '🟢 低'
    };
    
    result.actionItems.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.description}`);
      lines.push('');
      lines.push(`- **优先级**: ${priorityMap[item.priority] || item.priority}`);
      lines.push(`- **影响**: ${item.impact}`);
      lines.push(`- **建议**: ${item.suggestedAction}`);
      if (item.relatedRecords.length > 0) {
        lines.push(`- **相关记录**: ${item.relatedRecords.join(', ')}`);
      }
      lines.push('');
    });
  }
  
  if (options.includeIssues && result.issues.length > 0) {
    lines.push('## 对账问题');
    lines.push('');
    
    result.issues.forEach((issue, index) => {
      lines.push(`### ${index + 1}. ${issue.message}`);
      lines.push('');
      lines.push(`- **类型**: ${issue.type}`);
      lines.push(`- **对利润的影响**: ${issue.impactOnProfit}`);
      lines.push(`- **需要操作**: ${issue.actionRequired}`);
      if (Object.keys(issue.details).length > 0) {
        lines.push(`- **详细信息**: \`\`\`json\n${JSON.stringify(issue.details, null, 2)}\n\`\`\``);
      }
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

function exportReconciliationToCsv(
  result: ReconciliationResult,
  options: ExportOptions,
  config: Config
): string {
  const { formatCurrency, formatPercentage } = require('./utils');
  const records: any[] = [];
  
  if (options.includeDailyDetails && result.dailySummary.length > 0) {
    result.dailySummary.forEach(daily => {
      records.push({
        type: 'daily',
        date: daily.date,
        stallName: daily.stallName,
        totalOrders: daily.sales.totalOrders,
        totalQuantity: daily.sales.totalQuantity,
        grossRevenue: formatCurrency(daily.sales.grossRevenue, config),
        costOfGoodsSold: formatCurrency(daily.costs.costOfGoodsSold, config),
        totalReturns: formatCurrency(daily.returns.totalRefundAmount, config),
        totalDamages: formatCurrency(daily.damages.totalCost, config),
        totalFees: formatCurrency(daily.fees.totalFees, config),
        netProfit: formatCurrency(daily.profit.netProfit, config),
        profitMargin: formatPercentage(daily.profit.profitMargin)
      });
    });
  }
  
  if (options.includeProductDetails && Object.keys(result.byProduct).length > 0) {
    Object.entries(result.byProduct).forEach(([productId, product]) => {
      records.push({
        type: 'product',
        productName: product.productName,
        category: product.category,
        totalQuantitySold: product.totalQuantitySold,
        totalQuantityReturned: product.totalQuantityReturned,
        totalRevenue: formatCurrency(product.totalRevenue, config),
        totalCost: formatCurrency(product.totalCost, config),
        netProfit: formatCurrency(product.netProfit, config),
        profitMargin: formatPercentage(product.profitMargin)
      });
    });
  }
  
  if (records.length === 0) {
    records.push({
      type: 'summary',
      period: `${result.period.startDate || ''} 至 ${result.period.endDate || ''}`,
      totalRevenue: formatCurrency(result.overall.totalRevenue, config),
      totalCost: formatCurrency(result.overall.totalCost, config),
      totalReturns: formatCurrency(result.overall.totalReturns, config),
      totalDamages: formatCurrency(result.overall.totalDamages, config),
      totalFees: formatCurrency(result.overall.totalFees, config),
      totalPlatformFees: formatCurrency(result.overall.totalPlatformFees, config),
      totalTaxes: formatCurrency(result.overall.totalTaxes, config),
      grossProfit: formatCurrency(result.overall.grossProfit, config),
      netProfit: formatCurrency(result.overall.netProfit, config),
      profitMargin: formatPercentage(result.overall.profitMargin)
    });
  }
  
  return stringify(records, { header: true });
}

function exportValidationToMarkdown(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push('# 数据验证报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**验证结果**: ${result.valid ? '✅ 通过' : '❌ 失败'}`);
  lines.push(`**错误数**: ${result.totalErrors}`);
  lines.push(`**警告数**: ${result.totalWarnings}`);
  lines.push('');
  
  lines.push('## 问题统计');
  lines.push('');
  lines.push('| 问题类型 | 数量 |');
  lines.push('|----------|------|');
  lines.push(`| 缺失字段 | ${result.summary.missingFields} |`);
  lines.push(`| 重复订单 | ${result.summary.duplicateOrders} |`);
  lines.push(`| 收款不符 | ${result.summary.paymentMismatches} |`);
  lines.push(`| 负库存 | ${result.summary.negativeStock} |`);
  lines.push(`| 无效退货 | ${result.summary.invalidReturns} |`);
  lines.push(`| 跨天问题 | ${result.summary.crossDayIssues} |`);
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push('## 错误详情 (必须处理)');
    lines.push('');
    
    result.errors.forEach((error, index) => {
      lines.push(`### ${index + 1}. ${error.message}`);
      lines.push('');
      lines.push(`- **类型**: ${error.type}`);
      lines.push(`- **对利润的影响**: ${error.impactOnProfit}`);
      lines.push(`- **需要操作**: ${error.actionRequired}`);
      if (Object.keys(error.details).length > 0) {
        lines.push(`- **详细信息**: \`\`\`json\n${JSON.stringify(error.details, null, 2)}\n\`\`\``);
      }
      lines.push('');
    });
  }
  
  if (result.warnings.length > 0) {
    lines.push('## 警告详情 (建议处理)');
    lines.push('');
    
    result.warnings.forEach((warning, index) => {
      lines.push(`### ${index + 1}. ${warning.message}`);
      lines.push('');
      lines.push(`- **类型**: ${warning.type}`);
      lines.push(`- **对利润的影响**: ${warning.impactOnProfit}`);
      lines.push(`- **需要操作**: ${warning.actionRequired}`);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

function exportValidationToCsv(result: ValidationResult): string {
  const records: any[] = [];
  
  result.errors.forEach((error, index) => {
    records.push({
      severity: 'error',
      index: index + 1,
      type: error.type,
      message: error.message,
      impactOnProfit: error.impactOnProfit,
      actionRequired: error.actionRequired,
      details: JSON.stringify(error.details)
    });
  });
  
  result.warnings.forEach((warning, index) => {
    records.push({
      severity: 'warning',
      index: index + 1,
      type: warning.type,
      message: warning.message,
      impactOnProfit: warning.impactOnProfit,
      actionRequired: warning.actionRequired,
      details: JSON.stringify(warning.details)
    });
  });
  
  return stringify(records, { header: true });
}

function exportComparisonToMarkdown(
  result: ComparisonResult,
  config: Config
): string {
  const { formatCurrency, formatPercentage } = require('./utils');
  const lines: string[] = [];
  
  lines.push('# 对比分析报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**基准期**: ${result.basePeriod.startDate} 至 ${result.basePeriod.endDate}`);
  lines.push(`**对比期**: ${result.comparePeriod.startDate} 至 ${result.comparePeriod.endDate}`);
  lines.push('');
  
  lines.push('## 核心指标对比');
  lines.push('');
  lines.push('| 指标 | 基准期 | 对比期 | 变化额 | 变化率 |');
  lines.push('|------|--------|--------|--------|--------|');
  
  const diff = result.differences;
  const revenueChangeStr = diff.revenue.absoluteChange >= 0 ? '+' : '';
  const revenueChangePercentStr = diff.revenue.percentageChange >= 0 ? '+' : '';
  
  lines.push(`| 总营收 | ${formatCurrency(diff.revenue.base, config)} | ${formatCurrency(diff.revenue.compare, config)} | ${revenueChangeStr}${formatCurrency(diff.revenue.absoluteChange, config)} | ${revenueChangePercentStr}${formatPercentage(diff.revenue.percentageChange)} |`);
  
  const costChangeStr = diff.cost.absoluteChange >= 0 ? '+' : '';
  const costChangePercentStr = diff.cost.percentageChange >= 0 ? '+' : '';
  
  lines.push(`| 总成本 | ${formatCurrency(diff.cost.base, config)} | ${formatCurrency(diff.cost.compare, config)} | ${costChangeStr}${formatCurrency(diff.cost.absoluteChange, config)} | ${costChangePercentStr}${formatPercentage(diff.cost.percentageChange)} |`);
  
  const profitChangeStr = diff.netProfit.absoluteChange >= 0 ? '+' : '';
  const profitChangePercentStr = diff.netProfit.percentageChange >= 0 ? '+' : '';
  
  lines.push(`| 净利润 | ${formatCurrency(diff.netProfit.base, config)} | ${formatCurrency(diff.netProfit.compare, config)} | ${profitChangeStr}${formatCurrency(diff.netProfit.absoluteChange, config)} | ${profitChangePercentStr}${formatPercentage(diff.netProfit.percentageChange)} |`);
  
  const marginChangeStr = diff.profitMargin.absoluteChange >= 0 ? '+' : '';
  
  lines.push(`| 利润率 | ${formatPercentage(diff.profitMargin.base)} | ${formatPercentage(diff.profitMargin.compare)} | ${marginChangeStr}${formatPercentage(diff.profitMargin.absoluteChange)} | - |`);
  lines.push('');
  
  if (Object.keys(diff.byStall).length > 0) {
    lines.push('## 摊位对比');
    lines.push('');
    lines.push('| 摊位 | 营收变化 | 营收变化率 | 利润变化 | 利润变化率 |');
    lines.push('|------|----------|------------|----------|------------|');
    
    Object.entries(diff.byStall).forEach(([stallId, stall]) => {
      const revChangeStr = stall.revenueChange >= 0 ? '+' : '';
      const revChangePercentStr = stall.revenueChangePercent >= 0 ? '+' : '';
      const profitChangeStr = stall.profitChange >= 0 ? '+' : '';
      const profitChangePercentStr = stall.profitChangePercent >= 0 ? '+' : '';
      
      lines.push(`| ${stall.stallName} | ${revChangeStr}${formatCurrency(stall.revenueChange, config)} | ${revChangePercentStr}${formatPercentage(stall.revenueChangePercent)} | ${profitChangeStr}${formatCurrency(stall.profitChange, config)} | ${profitChangePercentStr}${formatPercentage(stall.profitChangePercent)} |`);
    });
    lines.push('');
  }
  
  if (Object.keys(diff.byProduct).length > 0) {
    lines.push('## 商品对比 (按利润变化排序)');
    lines.push('');
    lines.push('| 商品 | 销量变化 | 营收变化 | 利润变化 | 利润率变化 |');
    lines.push('|------|----------|----------|----------|------------|');
    
    const sortedProducts = Object.entries(diff.byProduct)
      .sort((a, b) => Math.abs(b[1].profitChange) - Math.abs(a[1].profitChange));
    
    sortedProducts.forEach(([productId, product]) => {
      const qtyChangeStr = product.quantityChange >= 0 ? '+' : '';
      const revChangeStr = product.revenueChange >= 0 ? '+' : '';
      const profitChangeStr = product.profitChange >= 0 ? '+' : '';
      const profitChangePercentStr = product.profitChangePercent >= 0 ? '+' : '';
      
      lines.push(`| ${product.productName} | ${qtyChangeStr}${product.quantityChange} | ${revChangeStr}${formatCurrency(product.revenueChange, config)} | ${profitChangeStr}${formatCurrency(product.profitChange, config)} | ${profitChangePercentStr}${formatPercentage(product.profitChangePercent)} |`);
    });
    lines.push('');
  }
  
  if (result.insights.length > 0) {
    lines.push('## 分析洞察');
    lines.push('');
    
    result.insights.forEach((insight, index) => {
      lines.push(`${index + 1}. ${insight}`);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

function exportComparisonToCsv(
  result: ComparisonResult,
  config: Config
): string {
  const { formatCurrency, formatPercentage } = require('./utils');
  const records: any[] = [];
  
  records.push({
    type: 'summary',
    basePeriod: `${result.basePeriod.startDate} 至 ${result.basePeriod.endDate}`,
    comparePeriod: `${result.comparePeriod.startDate} 至 ${result.comparePeriod.endDate}`,
    metric: '总营收',
    baseValue: formatCurrency(result.differences.revenue.base, config),
    compareValue: formatCurrency(result.differences.revenue.compare, config),
    absoluteChange: formatCurrency(result.differences.revenue.absoluteChange, config),
    percentageChange: formatPercentage(result.differences.revenue.percentageChange)
  });
  
  records.push({
    type: 'summary',
    basePeriod: `${result.basePeriod.startDate} 至 ${result.basePeriod.endDate}`,
    comparePeriod: `${result.comparePeriod.startDate} 至 ${result.comparePeriod.endDate}`,
    metric: '总成本',
    baseValue: formatCurrency(result.differences.cost.base, config),
    compareValue: formatCurrency(result.differences.cost.compare, config),
    absoluteChange: formatCurrency(result.differences.cost.absoluteChange, config),
    percentageChange: formatPercentage(result.differences.cost.percentageChange)
  });
  
  records.push({
    type: 'summary',
    basePeriod: `${result.basePeriod.startDate} 至 ${result.basePeriod.endDate}`,
    comparePeriod: `${result.comparePeriod.startDate} 至 ${result.comparePeriod.endDate}`,
    metric: '净利润',
    baseValue: formatCurrency(result.differences.netProfit.base, config),
    compareValue: formatCurrency(result.differences.netProfit.compare, config),
    absoluteChange: formatCurrency(result.differences.netProfit.absoluteChange, config),
    percentageChange: formatPercentage(result.differences.netProfit.percentageChange)
  });
  
  Object.entries(result.differences.byStall).forEach(([stallId, stall]) => {
    records.push({
      type: 'stall',
      stallName: stall.stallName,
      revenueChange: formatCurrency(stall.revenueChange, config),
      revenueChangePercent: formatPercentage(stall.revenueChangePercent),
      profitChange: formatCurrency(stall.profitChange, config),
      profitChangePercent: formatPercentage(stall.profitChangePercent)
    });
  });
  
  Object.entries(result.differences.byProduct).forEach(([productId, product]) => {
    records.push({
      type: 'product',
      productName: product.productName,
      quantityChange: product.quantityChange,
      quantityChangePercent: formatPercentage(product.quantityChangePercent),
      revenueChange: formatCurrency(product.revenueChange, config),
      revenueChangePercent: formatPercentage(product.revenueChangePercent),
      profitChange: formatCurrency(product.profitChange, config),
      profitChangePercent: formatPercentage(product.profitChangePercent)
    });
  });
  
  return stringify(records, { header: true });
}
