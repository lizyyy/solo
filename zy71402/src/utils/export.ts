import * as XLSX from 'xlsx';
import type { Batch, Material, ParsedTerms, CalculationResult, ValidationIssue, PayoutPlan, OperationLog } from '../types';
import { getIssueTypeLabel, getSeverityLabel, getMaterialStatusLabel } from '../engine/validator';

export function exportToExcel(
  batch: Batch,
  materials: Material[],
  terms: ParsedTerms | null,
  calculations: CalculationResult[],
  issues: ValidationIssue[],
  plans: PayoutPlan[],
  logs: OperationLog[]
) {
  const wb = XLSX.utils.book_new();
  
  const coverData = [
    ['结构性存款收益复核报告'],
    [''],
    ['批次名称', batch.name],
    ['批次号', batch.id],
    ['创建时间', new Date(batch.createdAt).toLocaleString('zh-CN')],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    ['状态', getStatusLabel(batch.status)],
    ['问题数', `${batch.errorCount} 错误, ${batch.warningCount} 警告`],
    [''],
    ['产品信息'],
    ['产品代码', terms?.productCode || ''],
    ['产品名称', terms?.productName || ''],
    ['挂钩标的', terms?.underlying || ''],
    ['币种', terms?.currency || ''],
    ['期限', terms?.termDays ? `${terms.termDays} 天` : ''],
  ];
  const coverSheet = XLSX.utils.aoa_to_sheet(coverData);
  coverSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, coverSheet, '报告封面');
  
  if (materials.length > 0) {
    const materialsData = [
      ['文件名', '材料类型', '状态', '导入时间', '版本', '数据指纹'],
      ...materials.map(m => [
        m.filename,
        getMaterialTypeLabel(m.type),
        getMaterialStatusLabel(m.status),
        new Date(m.importedAt).toLocaleString('zh-CN'),
        `v${m.version}`,
        m.dataHash.substring(0, 16) + '...',
      ])
    ];
    const materialsSheet = XLSX.utils.aoa_to_sheet(materialsData);
    materialsSheet['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, materialsSheet, '原始材料清单');
  }
  
  if (terms) {
    const intervalsData = [
      ['观察区间'],
      ['序号', '开始日期', '结束日期', '价格下限', '下限包含', '价格上限', '上限包含'],
      ...terms.observationIntervals.map((interval, i) => [
        i + 1,
        interval.startDate,
        interval.endDate,
        interval.lowerBound,
        interval.lowerInclusive ? '是 (≥)' : '否 (>)',
        interval.upperBound,
        interval.upperInclusive ? '是 (≤)' : '否 (<)',
      ])
    ];
    
    const tiersData = [
      [''],
      ['收益档位'],
      ['序号', '价格下限', '下限包含', '价格上限', '上限包含', '收益率', '说明'],
      ...terms.returnTiers.map((tier, i) => [
        i + 1,
        tier.lowerBound === -Infinity ? '-∞' : tier.lowerBound,
        tier.lowerInclusive ? '是 (≥)' : '否 (>)',
        tier.upperBound === Infinity ? '+∞' : tier.upperBound,
        tier.upperInclusive ? '是 (≤)' : '否 (<)',
        `${(tier.returnRate * 100).toFixed(2)}%`,
        tier.description,
      ])
    ];
    
    const termsData = [
      ...intervalsData,
      ...tiersData,
    ];
    
    if (terms.earlyTermination?.enabled) {
      termsData.push(
        [''],
        ['提前终止条款'],
        ['触发条件', terms.earlyTermination.triggerCondition],
        ['触发水平', terms.earlyTermination.triggerLevel],
        ['提前终止收益率', `${(terms.earlyTermination.returnRate * 100).toFixed(2)}%`],
        ['观察日期', terms.earlyTermination.observationDates.join(', ')]
      );
    }
    
    const termsSheet = XLSX.utils.aoa_to_sheet(termsData);
    termsSheet['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, termsSheet, '条款解析结果');
  }
  
  if (calculations.length > 0) {
    const calcData = [
      ['客户名称', '本金', '观察日期', '观察价格', '匹配档位', '收益率', '收益金额', '兑付金额', '是否提前终止', '终止日期'],
      ...calculations.map(c => [
        c.customerName,
        c.principal,
        c.observationDate,
        c.observationPrice.toFixed(4),
        c.matchedTierDescription,
        `${(c.returnRate * 100).toFixed(2)}%`,
        c.calculatedReturn,
        c.payoutAmount,
        c.earlyTerminated ? '是' : '否',
        c.terminationDate || '',
      ])
    ];
    const calcSheet = XLSX.utils.aoa_to_sheet(calcData);
    calcSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, calcSheet, '计算明细');
  }
  
  if (issues.length > 0) {
    const issueData = [
      ['严重程度', '问题类型', '问题描述', '触发来源', '卡点位置', '处理建议', '是否已解决', '解决备注'],
      ...issues.map(i => [
        getSeverityLabel(i.severity),
        getIssueTypeLabel(i.type),
        i.description,
        i.triggeredBy,
        i.blockedAt,
        i.suggestion,
        i.resolved ? '是' : '否',
        i.resolutionNote || '',
      ])
    ];
    const issueSheet = XLSX.utils.aoa_to_sheet(issueData);
    issueSheet['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, issueSheet, '问题清单');
  }
  
  if (plans.length > 0) {
    plans.forEach((plan, planIndex) => {
      const planData = [
        [`方案${planIndex + 1}: ${plan.name}`],
        [plan.description],
        [''],
        ['客户数量', `${plan.details.length} 位`],
        ['本金合计', plan.totalPrincipal],
        ['收益合计', plan.totalReturn],
        ['兑付合计', plan.totalPayout],
        ['平均收益率', `${(plan.averageReturnRate * 100).toFixed(2)}%`],
        ['是否选中', plan.isSelected ? '是' : '否'],
        [''],
        ['客户名称', '本金', '收益率', '收益金额', '兑付金额', '备注'],
        ...plan.details.map(d => [
          d.customerName,
          d.principal,
          `${(d.returnRate * 100).toFixed(2)}%`,
          d.calculatedReturn,
          d.payoutAmount,
          d.matchedTierDescription,
        ])
      ];
      
      const planSheet = XLSX.utils.aoa_to_sheet(planData);
      planSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, planSheet, `兑付方案${planIndex + 1}`);
    });
  }
  
  if (logs.length > 0) {
    const logData = [
      ['时间', '操作人', '操作内容'],
      ...logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(l => [
          new Date(l.timestamp).toLocaleString('zh-CN'),
          l.operator,
          l.action,
        ])
    ];
    const logSheet = XLSX.utils.aoa_to_sheet(logData);
    logSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, logSheet, '操作日志');
  }
  
  XLSX.writeFile(wb, `结构性存款收益复核报告_${batch.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportIssuesToCsv(issues: ValidationIssue[], batchName: string) {
  const headers = ['严重程度', '问题类型', '问题描述', '触发来源', '卡点位置', '处理建议', '是否已解决'];
  const rows = issues.map(i => [
    getSeverityLabel(i.severity),
    getIssueTypeLabel(i.type),
    `"${i.description.replace(/"/g, '""')}"`,
    i.triggeredBy,
    i.blockedAt,
    `"${i.suggestion.replace(/"/g, '""')}"`,
    i.resolved ? '是' : '否',
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `问题清单_${batchName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCalculationsToCsv(calculations: CalculationResult[], batchName: string) {
  const headers = ['客户名称', '本金', '观察日期', '观察价格', '匹配档位', '收益率(%)', '收益金额', '兑付金额', '是否提前终止'];
  const rows = calculations.map(c => [
    c.customerName,
    c.principal,
    c.observationDate,
    c.observationPrice.toFixed(4),
    `"${c.matchedTierDescription.replace(/"/g, '""')}"`,
    (c.returnRate * 100).toFixed(2),
    c.calculatedReturn,
    c.payoutAmount,
    c.earlyTerminated ? '是' : '否',
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `计算明细_${batchName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: '草稿',
    importing: '导入中',
    parsing: '解析中',
    calculating: '计算中',
    validating: '校验中',
    has_issues: '存在问题',
    ready: '待确认',
    completed: '已完成',
    archived: '已归档',
  };
  return labels[status] || status;
}

function getMaterialTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    product_terms: '产品条款',
    customer_position: '客户持仓',
    underlying_price: '标的价格',
  };
  return labels[type] || type;
}
