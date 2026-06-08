import * as XLSX from 'xlsx';
import { WeightRow, UnifiedResult, ChangeHistoryEntry } from '../types';

export interface ImportedRow {
  criterion: string;
  weight: string;
}

export function parseExcelFile(file: File): Promise<ImportedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, string>>;
        
        const rows: ImportedRow[] = jsonData.map(row => {
          const keys = Object.keys(row);
          return {
            criterion: row[keys[0]] || '',
            weight: String(row[keys[1]] || '')
          };
        }).filter(r => r.criterion && r.weight);
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function exportToExcel(unifiedResult: UnifiedResult): void {
  const exportData = unifiedResult.rows.map((row: WeightRow) => ({
    '数据版本': unifiedResult.dataVersion,
    '原始行号': row.originalRowNumber,
    '指标名称': row.criterionName,
    '原始值(保留原格式)': row.originalValue,
    '计算值(小数)': row.currentValue.toFixed(6),
    '格式类型': row.isPercent ? '百分比' : '小数',
    '当前状态': getStatusText(row.status),
    '警告类型(同步)': row.warnings.map(w => getWarningText(w)).join('；') || '(无)',
    '是否人工修改': row.isManualModified ? '是' : '否',
    '修改人': row.modifiedBy || '',
    '修改时间': row.modifiedAt ? new Date(row.modifiedAt).toLocaleString() : '',
    '原始说法(复核)': row.reviewInfo?.previousValue || row.originalValue,
    '改后值(复核)': row.reviewInfo?.newValue || '',
    '处理原因(复核)': row.reviewInfo?.reason || '',
    '下一步找谁(复核)': row.reviewInfo?.nextHandler || '',
    '复核时间': row.reviewInfo ? new Date(row.reviewInfo.reviewedAt).toLocaleString() : '',
    '复核人': row.reviewInfo?.reviewedBy || '',
    '是否已最终确认': row.reviewInfo?.finalized ? '是' : (row.reviewInfo ? '待确认' : '未发起复核'),
    '备注': row.notes || ''
  }));

  const summaryData = [
    { '统计项': '总行数', '数值': unifiedResult.summary.totalRows },
    { '统计项': '正常数', '数值': unifiedResult.summary.normalCount },
    { '统计项': '警告数', '数值': unifiedResult.summary.warningCount },
    { '统计项': '错误数', '数值': unifiedResult.summary.errorCount },
    { '统计项': '待复核数', '数值': unifiedResult.summary.needsReviewCount },
    { '统计项': '人工修改数', '数值': unifiedResult.summary.modifiedCount },
    { '统计项': '', '数值': '' },
    { '统计项': '矩阵条件数', '数值': unifiedResult.matrixResult?.conditionNumber.toFixed(4) || '' },
    { '统计项': '条件数阈值', '数值': unifiedResult.matrixResult?.threshold || '' },
    { '统计项': '是否预警', '数值': unifiedResult.matrixResult?.isWarning ? '是' : '否' },
    { '统计项': '最大特征值', '数值': unifiedResult.matrixResult?.details.maxEigenvalue.toFixed(4) || '' },
    { '统计项': '最小特征值', '数值': unifiedResult.matrixResult?.details.minEigenvalue.toFixed(4) || '' },
    { '统计项': '', '数值': '' },
    { '统计项': '当前步骤', '数值': getStepText(unifiedResult.processStep) },
    { '统计项': '导入人', '数值': unifiedResult.importedBy },
    { '统计项': '导入时间', '数值': new Date(unifiedResult.importTime).toLocaleString() },
    { '统计项': '数据版本', '数值': unifiedResult.dataVersion },
    { '统计项': '导出时间', '数值': new Date().toLocaleString() }
  ];

  const historyData = unifiedResult.history.map((h: ChangeHistoryEntry) => ({
    '变更ID': h.id,
    '指标行ID': h.rowId,
    '指标名称': h.criterionName,
    '变更字段': getFieldText(h.field),
    '变更前值': h.oldValue,
    '变更后值': h.newValue,
    '变更人': h.changedBy,
    '变更时间': new Date(h.changedAt).toLocaleString(),
    '变更原因': h.reason || ''
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(exportData);
  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  const ws3 = XLSX.utils.json_to_sheet(historyData);
  
  XLSX.utils.book_append_sheet(wb, ws1, '明细数据(与页面/接口一致)');
  XLSX.utils.book_append_sheet(wb, ws2, '汇总信息');
  XLSX.utils.book_append_sheet(wb, ws3, '变更历史');
  
  XLSX.writeFile(wb, `矩阵条件数预警_版本${unifiedResult.dataVersion}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待处理(改后未最终确认)',
    normal: '正常',
    warning: '警告',
    error: '错误',
    needs_review: '待复核(百分数混合/未确认)'
  };
  return statusMap[status] || status;
}

function getWarningText(warning: string): string {
  const warningMap: Record<string, string> = {
    percent_decimal_mixed: '百分数和小数混着出现(需负责人复核,不归正常)',
    duplicate_row: '重复导入的行',
    invalid_value: '无效值',
    high_condition_number: '矩阵条件数过高'
  };
  return warningMap[warning] || warning;
}

function getStepText(step: string): string {
  const stepMap: Record<string, string> = {
    step1_imported: '步骤1：第一次导入评分权重表',
    step2_formula_review: '步骤2：吴老师补看旧公式截图',
    step3_calculation_updated: '步骤3：计算明细更新'
  };
  return stepMap[step] || step;
}

function getFieldText(field: string): string {
  const fieldMap: Record<string, string> = {
    originalValue: '原始值',
    status: '状态',
    notes: '备注'
  };
  return fieldMap[field] || field;
}

export function exportForAPI(unifiedResult: UnifiedResult): UnifiedResult {
  return {
    ...unifiedResult,
    rows: unifiedResult.rows.map(r => ({ ...r })),
    history: unifiedResult.history.map(h => ({ ...h })),
    exportTime: new Date()
  };
}
