import { 
  FundUsageRecord, 
  Discrepancy, 
  ProcessingHistory,
  SourceMeta,
  ProspectusData,
  LedgerData,
  PaymentVoucher,
  ExportOptions,
  APPROVAL_STATUS_LABELS,
  DISCREPANCY_TYPE_LABELS,
  SOURCE_TYPE_LABELS
} from '../types';
import { formatAmount } from './fundCategorization';

export const exportToCsv = (
  records: FundUsageRecord[],
  discrepancies: Discrepancy[] = [],
  history: ProcessingHistory[] = [],
  options: ExportOptions
): string => {
  let csv = '';

  csv += '=== 绿色债券资金用途记录 ===\n';
  csv += generateRecordsCsv(records);
  csv += '\n\n';

  if (options.includeDiscrepancies && discrepancies.length > 0) {
    csv += '=== 差异记录 ===\n';
    csv += generateDiscrepanciesCsv(discrepancies);
    csv += '\n\n';
  }

  if (options.includeHistory && history.length > 0) {
    csv += '=== 处理历史 ===\n';
    csv += generateHistoryCsv(history);
    csv += '\n\n';
  }

  csv += `导出时间: ${new Date().toLocaleString()}\n`;
  csv += `导出范围: ${options.dateRange ? `${options.dateRange.start} 至 ${options.dateRange.end}` : '全部数据'}\n`;

  return csv;
};

const generateRecordsCsv = (records: FundUsageRecord[]): string => {
  const headers = [
    '项目名称',
    '债券代码',
    '用途分类',
    '计划金额',
    '实际金额',
    '支付日期',
    '披露版本',
    '审核状态',
    '说明',
    '影响结果',
    '创建时间',
    '更新时间'
  ];

  const rows = records.map(record => [
    escapeCsv(record.projectName),
    escapeCsv(record.bondCode),
    escapeCsv(record.category),
    escapeCsv(formatAmount(record.plannedAmount)),
    escapeCsv(formatAmount(record.actualAmount)),
    escapeCsv(record.paymentDate || ''),
    escapeCsv(record.disclosureVersion),
    escapeCsv(APPROVAL_STATUS_LABELS[record.approvalStatus]),
    escapeCsv(record.explanation || ''),
    escapeCsv(record.affectedResults?.join('; ') || ''),
    escapeCsv(new Date(record.createdAt).toLocaleString()),
    escapeCsv(new Date(record.updatedAt).toLocaleString())
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

const generateDiscrepanciesCsv = (discrepancies: Discrepancy[]): string => {
  const headers = [
    '差异类型',
    '严重程度',
    '描述',
    '关联项目',
    '字段',
    '期望值',
    '实际值',
    '影响结果',
    '是否已解决',
    '解决方案'
  ];

  const rows = discrepancies.map(d => [
    escapeCsv(DISCREPANCY_TYPE_LABELS[d.type]),
    escapeCsv(d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'),
    escapeCsv(d.description),
    escapeCsv(d.recordId),
    escapeCsv(d.fieldName || ''),
    escapeCsv(d.expectedValue || ''),
    escapeCsv(d.actualValue || ''),
    escapeCsv(d.affectedResults.join('; ')),
    escapeCsv(d.resolved ? '是' : '否'),
    escapeCsv(d.resolution || '')
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

const generateHistoryCsv = (history: ProcessingHistory[]): string => {
  const headers = [
    '操作',
    '旧值',
    '新值',
    '操作人',
    '操作时间',
    '原因'
  ];

  const rows = history.map(h => [
    escapeCsv(h.action),
    escapeCsv(h.oldValue || ''),
    escapeCsv(h.newValue || ''),
    escapeCsv(h.operator),
    escapeCsv(new Date(h.timestamp).toLocaleString()),
    escapeCsv(h.reason || '')
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

const escapeCsv = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const exportSourcesCsv = (sources: SourceMeta[]): string => {
  const headers = [
    '来源类型',
    '名称',
    '版本',
    '上传日期',
    '上传人',
    '说明'
  ];

  const rows = sources.map(s => [
    escapeCsv(SOURCE_TYPE_LABELS[s.type]),
    escapeCsv(s.name),
    escapeCsv(s.version),
    escapeCsv(new Date(s.uploadDate).toLocaleString()),
    escapeCsv(s.uploadUser),
    escapeCsv(s.description || '')
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

export const exportVouchersCsv = (
  vouchers: PaymentVoucher[],
  sources: SourceMeta[]
): string => {
  const headers = [
    '凭证号',
    '项目名称',
    '金额',
    '付款日期',
    '收款方',
    '用途分类',
    '摘要',
    '有发票',
    '已审批',
    '数据来源',
    '来源版本'
  ];

  const rows = vouchers.map(v => {
    const source = sources.find(s => s.id === v.sourceId);
    return [
      escapeCsv(v.voucherNumber),
      escapeCsv(v.projectName),
      escapeCsv(formatAmount(v.amount)),
      escapeCsv(v.paymentDate),
      escapeCsv(v.payee),
      escapeCsv(v.category),
      escapeCsv(v.description),
      escapeCsv(v.hasReceipt ? '是' : '否'),
      escapeCsv(v.hasApproval ? '是' : '否'),
      escapeCsv(source ? SOURCE_TYPE_LABELS[source.type] : ''),
      escapeCsv(source?.version || '')
    ];
  });

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

export const downloadCsv = (content: string, filename: string): void => {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateSummaryReport = (
  records: FundUsageRecord[],
  discrepancies: Discrepancy[],
  sources: SourceMeta[]
): string => {
  const totalPlanned = records.reduce((sum, r) => sum + r.plannedAmount, 0);
  const totalActual = records.reduce((sum, r) => sum + r.actualAmount, 0);
  const unresolvedDiscrepancies = discrepancies.filter(d => !d.resolved);
  
  const byCategory: Record<string, { planned: number; actual: number; count: number }> = {};
  records.forEach(r => {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { planned: 0, actual: 0, count: 0 };
    }
    byCategory[r.category].planned += r.plannedAmount;
    byCategory[r.category].actual += r.actualAmount;
    byCategory[r.category].count += 1;
  });

  let report = '绿色债券资金用途汇总报告\n';
  report += '='.repeat(50) + '\n\n';
  report += `生成时间: ${new Date().toLocaleString()}\n\n`;
  
  report += '一、总体概览\n';
  report += '-'.repeat(30) + '\n';
  report += `项目总数: ${records.length} 个\n`;
  report += `计划总金额: ${formatAmount(totalPlanned)}\n`;
  report += `实际支出: ${formatAmount(totalActual)}\n`;
  report += `执行进度: ${((totalActual / totalPlanned) * 100).toFixed(2)}%\n`;
  report += `数据来源: ${sources.length} 个文件\n`;
  report += `待处理差异: ${unresolvedDiscrepancies.length} 项\n\n`;

  report += '二、分类明细\n';
  report += '-'.repeat(30) + '\n';
  Object.entries(byCategory).forEach(([category, data]) => {
    report += `\n【${category}】\n`;
    report += `  项目数: ${data.count} 个\n`;
    report += `  计划金额: ${formatAmount(data.planned)}\n`;
    report += `  实际支出: ${formatAmount(data.actual)}\n`;
    report += `  进度: ${((data.actual / data.planned) * 100).toFixed(2)}%\n`;
  });

  report += '\n\n三、待处理差异\n';
  report += '-'.repeat(30) + '\n';
  if (unresolvedDiscrepancies.length === 0) {
    report += '无待处理差异\n';
  } else {
    unresolvedDiscrepancies.slice(0, 10).forEach((d, i) => {
      const record = records.find(r => r.id === d.recordId);
      report += `\n${i + 1}. [${d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'}] ${DISCREPANCY_TYPE_LABELS[d.type]}\n`;
      report += `   项目: ${record?.projectName || d.recordId}\n`;
      report += `   描述: ${d.description}\n`;
      report += `   影响: ${d.affectedResults[0]}\n`;
    });
    if (unresolvedDiscrepancies.length > 10) {
      report += `\n... 还有 ${unresolvedDiscrepancies.length - 10} 项差异，请查看完整导出文件\n`;
    }
  }

  return report;
};
