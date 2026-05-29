import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import type { RedemptionListItem, FilterConditions, ConflictRecord, StatusChangeLog, ExportConfig } from '@/types';
import { formatDate, formatDateTime, formatNumber, getStatusLabel, getConflictLabel } from './format';

interface ExportSheetData {
  name: string;
  data: Record<string, unknown>[];
  headers: string[];
}

const getConflictLabels = (conflicts: string[]): string => {
  return conflicts.map((c) => getConflictLabel(c as never)).join('、') || '无';
};

const generateBaseSheet = (
  listItems: RedemptionListItem[],
  filterConditions: FilterConditions
): ExportSheetData => {
  const headers = [
    '序号',
    '债券代码',
    '债券名称',
    '客户名称',
    '持仓数量',
    '申请行权数量',
    '公告行权日',
    '申请行权日',
    '申请状态',
    '是否撤回',
    '异常类型',
    '公告版本',
    '最后更新时间',
  ];

  const data = listItems.map((item, index) => ({
    序号: index + 1,
    债券代码: item.bondCode,
    债券名称: item.bondName,
    客户名称: item.customerName,
    持仓数量: formatNumber(item.positionQuantity),
    申请行权数量: formatNumber(item.applyQuantity),
    公告行权日: formatDate(item.announcementExerciseDate),
    申请行权日: formatDate(item.applyExerciseDate),
    申请状态: getStatusLabel(item.applicationStatus),
    是否撤回: item.isWithdrawn ? '是' : '否',
    异常类型: getConflictLabels(item.conflicts),
    公告版本: item.latestAnnouncementVersion,
    最后更新时间: formatDateTime(item.lastUpdateTime),
  }));

  return { name: '基础数据', data, headers };
};

const generateConflictSheet = (
  listItems: RedemptionListItem[],
  conflictRecords: ConflictRecord[]
): ExportSheetData => {
  const headers = [
    '序号',
    '债券代码',
    '债券名称',
    '客户名称',
    '异常类型',
    '异常详情',
    '系统建议',
    '人工判断',
    '处理人',
    '创建时间',
  ];

  const filteredRecords = conflictRecords.filter((cr) =>
    listItems.some((item) => item.applicationId === cr.applicationId)
  );

  const itemMap = new Map(listItems.map((item) => [item.applicationId, item]));

  const data = filteredRecords.map((record, index) => {
    const item = itemMap.get(record.applicationId);
    return {
      序号: index + 1,
      债券代码: item?.bondCode || '',
      债券名称: item?.bondName || '',
      客户名称: item?.customerName || '',
      异常类型: getConflictLabel(record.conflictType),
      异常详情: record.conflictDetail,
      系统建议: record.systemSuggestion,
      人工判断: record.manualJudgment || '未处理',
      处理人: record.operator || '-',
      创建时间: formatDateTime(record.createTime),
    };
  });

  return { name: '异常详情', data, headers };
};

const generateHistorySheet = (
  listItems: RedemptionListItem[],
  statusChangeLogs: StatusChangeLog[]
): ExportSheetData => {
  const headers = [
    '序号',
    '债券代码',
    '债券名称',
    '客户名称',
    '变更前状态',
    '变更后状态',
    '变更时间',
    '操作人',
    '备注',
  ];

  const filteredLogs = statusChangeLogs.filter((log) =>
    listItems.some((item) => item.applicationId === log.applicationId)
  );

  const itemMap = new Map(listItems.map((item) => [item.applicationId, item]));

  const data = filteredLogs.map((log, index) => {
    const item = itemMap.get(log.applicationId);
    return {
      序号: index + 1,
      债券代码: item?.bondCode || '',
      债券名称: item?.bondName || '',
      客户名称: item?.customerName || '',
      变更前状态: log.fromStatus ? getStatusLabel(log.fromStatus) : '新建',
      变更后状态: getStatusLabel(log.toStatus),
      变更时间: formatDateTime(log.changeTime),
      操作人: log.operator,
      备注: log.remark || '-',
    };
  });

  return { name: '处理记录', data, headers };
};

const generateFilterInfoSheet = (
  filterConditions: FilterConditions,
  recordCount: number
): ExportSheetData => {
  const headers = ['项目', '内容'];

  const formatFilterValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'string' ? getStatusLabel(v as never) || v : v)).join('、');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value || '-');
  };

  const data = [
    { 项目: '导出时间', 内容: formatDateTime(new Date()) },
    { 项目: '记录总数', 内容: recordCount },
    { 项目: '筛选条件', 内容: '' },
    ...Object.entries(filterConditions)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({
        项目: `  ${key}`,
        内容: formatFilterValue(value),
      })),
  ];

  return { name: '筛选条件', data, headers };
};

const generateFileName = (filterConditions: FilterConditions): string => {
  const timestamp = dayjs().format('YYYYMMDD_HHmmss');
  const parts: string[] = ['债券回售行权名单'];

  if (filterConditions.bondCode) {
    parts.push(filterConditions.bondCode);
  }
  if (filterConditions.applicationStatus?.length) {
    parts.push(`${filterConditions.applicationStatus.length}种状态`);
  }
  if (filterConditions.conflictTypes?.length) {
    parts.push(`${filterConditions.conflictTypes.length}种异常`);
  }

  return `${parts.join('_')}_${timestamp}.xlsx`;
};

export const exportToExcel = (
  listItems: RedemptionListItem[],
  filterConditions: FilterConditions,
  conflictRecords: ConflictRecord[],
  statusChangeLogs: StatusChangeLog[],
  config: ExportConfig = {
    includeConflicts: true,
    includeProcessingHistory: true,
    includeAnnouncementVersions: false,
    fileFormat: 'xlsx',
  }
): string => {
  const wb = XLSX.utils.book_new();

  const baseSheet = generateBaseSheet(listItems, filterConditions);
  const ws1 = XLSX.utils.json_to_sheet(baseSheet.data, { header: baseSheet.headers });
  XLSX.utils.book_append_sheet(wb, ws1, baseSheet.name);

  const filterSheet = generateFilterInfoSheet(filterConditions, listItems.length);
  const ws2 = XLSX.utils.json_to_sheet(filterSheet.data, { header: filterSheet.headers });
  XLSX.utils.book_append_sheet(wb, ws2, filterSheet.name);

  if (config.includeConflicts) {
    const conflictSheet = generateConflictSheet(listItems, conflictRecords);
    if (conflictSheet.data.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(conflictSheet.data, { header: conflictSheet.headers });
      XLSX.utils.book_append_sheet(wb, ws3, conflictSheet.name);
    }
  }

  if (config.includeProcessingHistory) {
    const historySheet = generateHistorySheet(listItems, statusChangeLogs);
    if (historySheet.data.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(historySheet.data, { header: historySheet.headers });
      XLSX.utils.book_append_sheet(wb, ws4, historySheet.name);
    }
  }

  const fileName = generateFileName(filterConditions);
  XLSX.writeFile(wb, fileName);

  return fileName;
};

export const generateExportSummary = (
  listItems: RedemptionListItem[],
  filterConditions: FilterConditions
): string => {
  const conflictCount = listItems.filter((item) => item.conflicts.length > 0).length;
  const normalCount = listItems.length - conflictCount;

  return `导出 ${listItems.length} 条记录，其中正常 ${normalCount} 条，异常 ${conflictCount} 条`;
};
