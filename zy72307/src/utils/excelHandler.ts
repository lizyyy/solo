import * as XLSX from 'xlsx';
import { WeightTableData, WeightRow, UnifiedResult } from '../types';
import { unifiedResultSource } from './resultSource';

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

export function exportToExcel(_data: WeightTableData): void {
  const result = unifiedResultSource.getUnifiedResult();
  
  const exportData = result.rows.map((row: WeightRow) => ({
    '原始行号': row.originalRowNumber,
    '指标名称': row.criterionName,
    '原始值': row.originalValue,
    '计算值': row.currentValue.toFixed(4),
    '是否百分比': row.isPercent ? '是' : '否',
    '状态': getStatusText(row.status),
    '警告类型': row.warnings.map(w => getWarningText(w)).join('; '),
    '是否人工修改': row.isManualModified ? '是' : '否',
    '修改人': row.modifiedBy || '',
    '修改时间': row.modifiedAt ? new Date(row.modifiedAt).toLocaleString() : '',
    '备注': row.notes || ''
  }));

  const summaryData = [
    { '统计项': '总行数', '数值': result.summary.totalRows },
    { '统计项': '警告数', '数值': result.summary.warningCount },
    { '统计项': '错误数', '数值': result.summary.errorCount },
    { '统计项': '待复核数', '数值': result.summary.needsReviewCount },
    { '统计项': '', '数值': '' },
    { '统计项': '矩阵条件数', '数值': result.matrixResult?.conditionNumber.toFixed(2) || '' },
    { '统计项': '条件数阈值', '数值': result.matrixResult?.threshold || '' },
    { '统计项': '是否预警', '数值': result.matrixResult?.isWarning ? '是' : '否' },
    { '统计项': '', '数值': '' },
    { '统计项': '导出时间', '数值': new Date().toLocaleString() }
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(exportData);
  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  
  XLSX.utils.book_append_sheet(wb, ws1, '明细数据');
  XLSX.utils.book_append_sheet(wb, ws2, '汇总信息');
  
  XLSX.writeFile(wb, `矩阵条件数预警_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    normal: '正常',
    warning: '警告',
    error: '错误',
    needs_review: '待复核'
  };
  return statusMap[status] || status;
}

function getWarningText(warning: string): string {
  const warningMap: Record<string, string> = {
    percent_decimal_mixed: '百分数小数混合',
    duplicate_row: '重复行',
    invalid_value: '无效值',
    high_condition_number: '高条件数'
  };
  return warningMap[warning] || warning;
}

export function exportForAPI(): UnifiedResult {
  return unifiedResultSource.getUnifiedResult();
}
