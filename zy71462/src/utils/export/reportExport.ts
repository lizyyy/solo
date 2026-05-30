import * as XLSX from 'xlsx';
import {
  Batch,
  Material,
  Holding,
  TargetWeight,
  PriceQuote,
  Task,
  TradeSuggestion,
  EvidenceRecord,
  ValidationError,
  RebalanceConfig,
} from '@/types';

export interface ExportOptions {
  includeRawData: boolean;
  includeCalculationDetails: boolean;
  includeEvidence: boolean;
  format: 'xlsx' | 'csv' | 'json';
}

function formatNumber(num: number, decimals: number = 2): string {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(num: number, decimals: number = 2): string {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return (num * 100).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}

function formatDate(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('zh-CN');
}

function formatDateTime(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

export function generateSummarySheet(
  batch: Batch,
  task: Task,
  holdings: Holding[]
): XLSX.WorkSheet {
  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostValue = holdings.reduce((sum, h) => sum + h.costValue, 0);
  const totalUnrealizedGain = holdings.reduce((sum, h) => sum + h.unrealizedGain, 0);

  const data = [
    ['投资组合税后再平衡报告'],
    [''],
    ['一、基本信息'],
    ['批次名称', batch.name],
    ['客户编号', batch.clientId],
    ['创建人', batch.createdBy],
    ['创建时间', formatDateTime(batch.createdAt)],
    ['计算完成时间', formatDateTime(task.completedAt)],
    ['版本号', `v${task.version}`],
    [''],
    ['二、组合概览'],
    ['总资产市值', formatNumber(totalMarketValue), '元'],
    ['总成本', formatNumber(totalCostValue), '元'],
    ['总浮动盈亏', formatNumber(totalUnrealizedGain), '元'],
    ['浮动盈亏率', formatPercent(totalUnrealizedGain / totalCostValue)],
    ['持仓数量', holdings.length, '只'],
    [''],
    ['三、再平衡结果'],
    ['优化目标', {
      minimize_tax: '最小化税费',
      maximize_after_tax: '最大化税后收益',
      minimize_tracking_error: '最小化跟踪误差',
    }[task.config.optimizationTarget]],
    ['预计总税费', formatNumber(task.totalTax), '元'],
    ['  其中：佣金', formatNumber(task.totalCommission), '元'],
    ['  其中：印花税', formatNumber(task.totalStampDuty), '元'],
    ['  其中：资本利得税', formatNumber(task.totalCapitalGainsTax), '元'],
    ['亏损抵扣额', formatNumber(task.totalLossOffset), '元'],
    ['税后收益', formatNumber(task.afterTaxReturn), '元'],
    ['跟踪误差', formatPercent(task.trackingError)],
    ['总换手率', formatPercent(task.totalTurnover / totalMarketValue)],
    [''],
    ['四、配置参数'],
    ['印花税率', formatPercent(task.config.taxRules.stampDutyRate, 4)],
    ['佣金率', formatPercent(task.config.taxRules.commissionRate, 4)],
    ['最低佣金', formatNumber(task.config.taxRules.commissionMin), '元'],
    ['短期利得税率', formatPercent(task.config.taxRules.shortTermCapitalGainsRate)],
    ['长期利得税率', formatPercent(task.config.taxRules.longTermCapitalGainsRate)],
    ['最低持有期', task.config.holdingPeriodRules.minHoldingDays, '天'],
    ['最小交易金额', formatNumber(task.config.constraints.minTradeValue), '元'],
    ['最大换手率', formatPercent(task.config.constraints.maxTurnoverPct)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 10 },
  ];
  return ws;
}

export function generateHoldingsSheet(
  holdings: Holding[],
  targetWeights: TargetWeight[]
): XLSX.WorkSheet {
  const targetWeightMap = new Map(targetWeights.map(t => [t.symbol, t.targetWeight]));

  const data = [
    ['代码', '名称', '持仓数量', '成本价', '市价', '买入日期', '持有天数', '市值', '成本', '浮动盈亏', '浮动盈亏率', '当前权重', '目标权重', '权重偏离'],
  ];

  for (const h of holdings) {
    const targetWeight = targetWeightMap.get(h.symbol) || 0;
    data.push([
      h.symbol,
      h.name,
      formatNumber(h.quantity, 0),
      formatNumber(h.costBasis, 2),
      formatNumber(h.marketPrice, 2),
      formatDate(h.purchaseDate),
      String(h.holdingDays),
      formatNumber(h.marketValue, 2),
      formatNumber(h.costValue, 2),
      formatNumber(h.unrealizedGain, 2),
      formatPercent(h.unrealizedGainPct),
      formatPercent(h.currentWeight),
      formatPercent(targetWeight),
      formatPercent(h.currentWeight - targetWeight),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  return ws;
}

export function generateTradesSheet(
  trades: TradeSuggestion[]
): XLSX.WorkSheet {
  const data = [
    ['代码', '名称', '操作', '数量', '价格', '金额', '佣金', '印花税', '资本利得税', '亏损抵扣', '税费合计', '净收付', '持有天数', '当前权重', '目标权重', '建议权重', '原因', '约束条件'],
  ];

  for (const t of trades) {
    if (t.action === 'hold') continue;
    
    data.push([
      t.symbol,
      t.name,
      { buy: '买入', sell: '卖出', hold: '持有' }[t.action],
      formatNumber(t.quantity, 0),
      formatNumber(t.price, 2),
      formatNumber(t.estimatedValue, 2),
      formatNumber(t.estimatedCommission, 2),
      formatNumber(t.estimatedStampDuty, 2),
      formatNumber(t.estimatedCapitalGainsTax, 2),
      formatNumber(t.lossOffsetApplied, 2),
      formatNumber(t.estimatedTotalTax, 2),
      formatNumber(t.netProceeds, 2),
      String(t.holdingDays),
      formatPercent(t.currentWeight),
      formatPercent(t.targetWeight),
      formatPercent(t.suggestedWeight),
      t.reason,
      t.constraints.join('; '),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 40 }, { wch: 30 },
  ];
  return ws;
}

export function generateEvidenceSheet(
  evidenceRecords: EvidenceRecord[]
): XLSX.WorkSheet {
  const data = [
    ['证据ID', '目标类型', '目标ID', '步骤序号', '操作', '公式', '输入项', '输入值', '来源', '结果', '时间戳'],
  ];

  for (const ev of evidenceRecords) {
    for (const step of ev.calculationSteps) {
      const inputEntries = Object.entries(step.inputs);
      for (let i = 0; i < inputEntries.length; i++) {
        const [inputName, inputData] = inputEntries[i];
        data.push([
          i === 0 ? ev.id : '',
          i === 0 ? { trade: '交易', tax: '税费', holding: '持仓' }[ev.targetType] : '',
          i === 0 ? ev.targetId : '',
          String(step.order),
          step.operation,
          step.formula,
          inputName,
          formatNumber(inputData.value, 6),
          inputData.source,
          i === 0 ? formatNumber(step.result, 6) : '',
          i === 0 ? formatDateTime(step.timestamp) : '',
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
    { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 },
  ];
  return ws;
}

export function generateErrorsSheet(
  errors: ValidationError[],
  materials: Material[]
): XLSX.WorkSheet {
  const materialMap = new Map(materials.map(m => [m.id, m]));

  const data = [
    ['错误ID', '严重性', '类别', '材料类型', '文件名', '上传人', '行号', '字段', '错误信息', '当前值', '期望值', '修复建议'],
  ];

  for (const err of errors) {
    const material = materialMap.get(err.materialId);
    data.push([
      err.id,
      { error: '错误', warning: '警告', info: '提示' }[err.severity],
      { tax: '税费', weight: '权重', loss_offset: '亏损抵扣', data_integrity: '数据完整性' }[err.category],
      { holding: '持仓表', target: '目标权重', price: '买卖报价' }[err.materialType],
      material?.fileName || '-',
      material?.uploadedBy || '-',
      err.rowIndex !== undefined ? String(err.rowIndex + 1) : '-',
      err.fieldName || '-',
      err.message,
      err.currentValue !== undefined ? String(err.currentValue) : '-',
      err.expectedValue !== undefined ? String(err.expectedValue) : '-',
      err.fixSuggestion,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 25 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
    { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 40 },
  ];
  return ws;
}

export function generateRawMaterialsSheet(
  materials: Material[]
): XLSX.WorkSheet {
  const data = [
    ['材料ID', '材料类型', '文件名', '文件哈希', '来源', '上传人', '上传时间', '版本', '是否重复', '原始内容'],
  ];

  for (const m of materials) {
    data.push([
      m.id,
      { holding: '持仓表', target: '目标权重', price: '买卖报价' }[m.type],
      m.fileName,
      m.fileHash,
      m.source,
      m.uploadedBy,
      formatDateTime(m.uploadedAt),
      String(m.version),
      m.isDuplicate ? '是' : '否',
      m.rawContent.substring(0, 1000),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 35 }, { wch: 15 },
    { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 50 },
  ];
  return ws;
}

export function exportToExcel(
  options: {
    batch: Batch;
    materials: Material[];
    holdings: Holding[];
    targetWeights: TargetWeight[];
    priceQuotes: PriceQuote[];
    task: Task;
    trades: TradeSuggestion[];
    evidenceRecords: EvidenceRecord[];
    validationErrors: ValidationError[];
  },
  exportOptions: ExportOptions
): void {
  const { batch, materials, holdings, targetWeights, task, trades, evidenceRecords, validationErrors } = options;

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, generateSummarySheet(batch, task, holdings), '报告摘要');
  XLSX.utils.book_append_sheet(wb, generateHoldingsSheet(holdings, targetWeights), '当前持仓');
  XLSX.utils.book_append_sheet(wb, generateTradesSheet(trades), '交易建议');
  
  if (exportOptions.includeEvidence) {
    XLSX.utils.book_append_sheet(wb, generateEvidenceSheet(evidenceRecords), '计算证据链');
  }
  
  if (validationErrors.length > 0) {
    XLSX.utils.book_append_sheet(wb, generateErrorsSheet(validationErrors, materials), '数据校验');
  }
  
  if (exportOptions.includeRawData) {
    XLSX.utils.book_append_sheet(wb, generateRawMaterialsSheet(materials), '原始材料');
  }

  const fileName = `再平衡报告_${batch.name}_v${task.version}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportTradesToCSV(trades: TradeSuggestion[]): void {
  const headers = ['代码', '名称', '操作', '数量', '价格', '金额', '佣金', '印花税', '资本利得税', '亏损抵扣', '税费合计', '净收付', '原因'];
  
  const rows = trades
    .filter(t => t.action !== 'hold')
    .map(t => [
      t.symbol,
      t.name,
      { buy: '买入', sell: '卖出', hold: '持有' }[t.action],
      t.quantity,
      t.price.toFixed(2),
      t.estimatedValue.toFixed(2),
      t.estimatedCommission.toFixed(2),
      t.estimatedStampDuty.toFixed(2),
      t.estimatedCapitalGainsTax.toFixed(2),
      t.lossOffsetApplied.toFixed(2),
      t.estimatedTotalTax.toFixed(2),
      t.netProceeds.toFixed(2),
      t.reason,
    ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `交易建议_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(
  data: Record<string, any>,
  fileName: string
): void {
  const jsonContent = JSON.stringify(data, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  }, 2);

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV<T>(
  data: T[],
  type: string
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0] as object);
  const rows = data.map(item => 
    headers.map(header => {
      const value = (item as Record<string, any>)[header];
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object' && value !== null) return JSON.stringify(value);
      return String(value ?? '');
    })
  );

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportEvidenceChain(
  evidenceRecords: EvidenceRecord[],
  batch: Batch | null
): void {
  const exportData = {
    exportTime: new Date().toISOString(),
    batchId: batch?.id,
    batchName: batch?.name,
    evidenceCount: evidenceRecords.length,
    records: evidenceRecords.map(ev => ({
      id: ev.id,
      targetType: ev.targetType,
      targetId: ev.targetId,
      materialIds: ev.sourceMaterialIds,
      createdAt: new Date().toISOString(),
      calculationSteps: ev.calculationSteps.map(step => ({
        order: step.order,
        operation: step.operation,
        formula: step.formula,
        inputs: step.inputs,
        result: step.result,
        timestamp: step.timestamp,
      })),
    })),
  };

  const fileName = `证据链_${batch?.name || '未命名'}_${new Date().toISOString().split('T')[0]}.json`;
  exportToJSON(exportData, fileName);
}
