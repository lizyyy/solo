import * as XLSX from 'xlsx';
import type { EstimationRecord, FilterState } from '../types';

const statusLabels: Record<string, string> = {
  success: '顺利完成',
  pending: '待确认',
  legacy: '旧口径',
  error: '计算失败',
};

const sourceLabels: Record<string, string> = {
  system: '系统生成',
  manual: '人工录入',
  legacy: '历史数据',
};

const anomalyTypeLabels: Record<string, string> = {
  empty_value: '空值',
  duplicate: '重复记录',
  unit_mismatch: '单位不匹配',
  outlier: '异常值',
  boundary: '边界值',
};

export class ExportService {
  static generateFilterDescription(filters: FilterState): string {
    const parts: string[] = [];
    if (filters.status.length > 0) {
      parts.push(`状态: ${filters.status.map(s => statusLabels[s]).join(', ')}`);
    }
    if (filters.area.length > 0) {
      parts.push(`区域: ${filters.area.join(', ')}`);
    }
    if (filters.source.length > 0) {
      parts.push(`来源: ${filters.source.map(s => sourceLabels[s]).join(', ')}`);
    }
    if (filters.dateRange.start || filters.dateRange.end) {
      parts.push(`日期范围: ${filters.dateRange.start || '不限'} 至 ${filters.dateRange.end || '不限'}`);
    }
    return parts.length > 0 ? parts.join('; ') : '无筛选条件';
  }

  static exportToCSV(records: EstimationRecord[], filters: FilterState): void {
    const filterDesc = this.generateFilterDescription(filters);
    
    const data = records.map(record => ({
      '记录编号': record.recordNo,
      '区域': record.area,
      '计算日期': record.calculationDate,
      '状态': statusLabels[record.status],
      '数据来源': sourceLabels[record.source],
      '参数版本': record.parameterVersion,
      '管网容量': record.calculatedResult ? `${record.calculatedResult.capacity.toFixed(2)} ${record.calculatedResult.unit}` : 'N/A',
      '异常数量': record.anomalies.length,
      '异常类型': record.anomalies.map(a => anomalyTypeLabels[a.type]).join('; '),
      '失败原因': record.failureReason || '',
      '备注': record.remark,
      '创建时间': record.createdAt,
    }));

    const filterRow = [{ '记录编号': '筛选条件说明', '区域': filterDesc }];
    const headerRow = [{ '记录编号': '--- 数据列表 ---' }];
    const exportData = [...filterRow, ...headerRow, ...data];

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '城市雨水管网容量估算');
    XLSX.writeFile(wb, `城市雨水管网容量估算_${new Date().toISOString().split('T')[0]}.csv`);
  }

  static exportToExcel(records: EstimationRecord[], filters: FilterState): void {
    const filterDesc = this.generateFilterDescription(filters);

    const summaryData = [
      { A: '城市雨水管网容量估算系统 - 导出报告' },
      { A: '导出时间', B: new Date().toLocaleString() },
      { A: '筛选条件', B: filterDesc },
      { A: '导出记录数', B: records.length },
      {},
    ];

    const mainData = records.map(record => ({
      '记录编号': record.recordNo,
      '区域': record.area,
      '计算日期': record.calculationDate,
      '状态': statusLabels[record.status],
      '数据来源': sourceLabels[record.source],
      '参数版本': record.parameterVersion,
      '管网容量(m³/h)': record.calculatedResult?.capacity.toFixed(2) || 'N/A',
      '异常数量': record.anomalies.length,
      '失败原因': record.failureReason || '',
      '备注': record.remark,
    }));

    const anomalyData = records.flatMap(record =>
      record.anomalies.map((anomaly, idx) => ({
        '记录编号': record.recordNo,
        '异常序号': idx + 1,
        '异常类型': anomalyTypeLabels[anomaly.type],
        '涉及字段': anomaly.field,
        '严重程度': anomaly.severity,
        '描述': anomaly.description,
      }))
    );

    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws1, '汇总信息');
    
    const ws2 = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws2, '估算记录');
    
    if (anomalyData.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(anomalyData);
      XLSX.utils.book_append_sheet(wb, ws3, '异常明细');
    }

    XLSX.writeFile(wb, `城市雨水管网容量估算_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}
