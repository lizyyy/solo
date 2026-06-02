import * as XLSX from 'xlsx';
import type { CarbonRecord, MergeGroup } from '@/types';
import { SOURCE_TYPE_LABELS, STATUS_LABELS } from '@/types';

export interface ExportRow {
  序号: number;
  标准点位名称: string;
  原始名称: string;
  地址: string;
  碳排放量: number;
  单位: string;
  数据来源: string;
  审核状态: string;
  记录日期: string;
  判断原因: string;
  操作人: string;
  备注: string;
}

function formatAuditTrail(record: CarbonRecord): string {
  if (!record.auditTrail || record.auditTrail.length === 0) {
    return '无审核记录';
  }

  return record.auditTrail
    .map(trail => {
      const actionMap: Record<string, string> = {
        import: '数据导入',
        merge: '自动归并',
        confirm: '人工确认',
        reject: '驳回',
        split: '拆分',
        supplement: '补录',
        remark: '添加备注',
      };
      const action = actionMap[trail.actionType] || trail.actionType;
      const time = new Date(trail.timestamp).toLocaleString('zh-CN');
      return `[${time}] ${action}: ${trail.actionReason}` + 
             (trail.remark ? ` (备注: ${trail.remark})` : '');
    })
    .join('; ');
}

export function exportToExcel(
  records: CarbonRecord[],
  mergeGroups: MergeGroup[],
  fileName: string = '低碳街区碳账本公示清单'
): void {
  const exportRows: ExportRow[] = records.map((record, index) => {
    const group = mergeGroups.find(g => g.mergedRecordIds.includes(record.id));
    const canonicalName = group ? group.canonicalName : record.pointName;
    const mergeReason = group ? group.mergeReason : '';
    const auditReason = formatAuditTrail(record);
    
    let judgementReason = auditReason;
    if (mergeReason && mergeReason !== auditReason) {
      judgementReason = `归并依据: ${mergeReason}; ${auditReason}`;
    }
    if (record.isOldCaliber) {
      judgementReason = `[旧口径补录] ${record.oldCaliberNote || ''}; ${judgementReason}`;
    }

    return {
      序号: index + 1,
      标准点位名称: canonicalName,
      原始名称: record.originalName,
      地址: record.address,
      碳排放量: record.carbonAmount,
      单位: record.unit,
      数据来源: SOURCE_TYPE_LABELS[record.sourceType] || record.sourceType,
      审核状态: STATUS_LABELS[record.status] || record.status,
      记录日期: record.recordDate,
      判断原因: judgementReason,
      操作人: record.operator,
      备注: record.remark,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 30 },
    { wch: 35 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 60 },
    { wch: 12 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '公示清单');

  const summaryData = [
    ['低碳街区碳账本 - 公示清单汇总'],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    ['总记录数', records.length],
    ['审核通过', records.filter(r => r.status === 'review_confirmed').length],
    ['待确认', records.filter(r => r.status === 'needs_confirmation').length],
    ['自动归并待确认', records.filter(r => r.status === 'auto_merged').length],
    ['已驳回', records.filter(r => r.status === 'rejected').length],
    ['总碳排放量', records.reduce((sum, r) => sum + r.carbonAmount, 0), 'kgCO2e'],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总信息');

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function calculateDiffs(
  oldRecord: Partial<CarbonRecord>,
  newRecord: Partial<CarbonRecord>
): { field: string; oldValue: string | number; newValue: string | number; isDiff: boolean }[] {
  const fieldLabels: Record<string, string> = {
    pointName: '点位名称',
    address: '地址',
    carbonAmount: '碳排放量',
    unit: '单位',
    recordDate: '记录日期',
    remark: '备注',
    sourceType: '数据来源',
  };

  const fields = ['pointName', 'address', 'carbonAmount', 'unit', 'recordDate', 'remark', 'sourceType'];

  return fields.map(field => {
    const oldVal = oldRecord[field as keyof CarbonRecord] ?? '';
    const newVal = newRecord[field as keyof CarbonRecord] ?? '';
    return {
      field: fieldLabels[field] || field,
      oldValue: oldVal as string | number,
      newValue: newVal as string | number,
      isDiff: String(oldVal) !== String(newVal),
    };
  });
}
