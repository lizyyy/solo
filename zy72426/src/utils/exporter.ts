import * as XLSX from 'xlsx';
import type { SongRecord, SongGroup } from '@/types';

const generateDataHash = (records: SongRecord[]): string => {
  const dataStr = JSON.stringify(
    records.map((r) => ({
      id: r.id,
      liveName: r.liveName,
      copyrightName: r.copyrightName,
      emotionTag: r.emotionTag,
      status: r.status,
    }))
  );

  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const generateCSVContent = (records: SongRecord[], groups: SongGroup[]): string => {
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const headers = [
    '原始行号',
    '现场名',
    '版权名',
    '情绪标签',
    '置信度',
    '处理状态',
    '音频备注',
    '分组规范名',
    '分组状态',
    '导入版本',
    '数据校验哈希',
  ];

  const rows = records.map((record) => {
    const group = record.groupId ? groupMap.get(record.groupId) : undefined;
    const statusMap: Record<string, string> = {
      pending: '待处理',
      reviewing: '复核中',
      confirmed: '已确认',
      exception: '异常',
    };
    const groupStatusMap: Record<string, string> = {
      pending: '待复核',
      confirmed: '已确认',
      rejected: '已拒绝',
    };

    return [
      record.originalRowNumber,
      record.liveName,
      record.copyrightName,
      record.emotionTag,
      (record.emotionConfidence * 100).toFixed(0) + '%',
      statusMap[record.status] || record.status,
      record.audioNote,
      group?.canonicalName || '',
      group ? groupStatusMap[group.reviewStatus] || group.reviewStatus : '',
      record.importVersion,
      '',
    ];
  });

  const dataHash = generateDataHash(records);
  rows.push(['', '', '', '', '', '', '', '', '', '数据哈希', dataHash]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ),
  ].join('\n');

  return csvContent;
};

export const exportCSV = (records: SongRecord[], groups: SongGroup[]): void => {
  const csvContent = generateCSVContent(records, groups);
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `音频样本情绪标签_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportExcel = (records: SongRecord[], groups: SongGroup[]): void => {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const statusMap: Record<string, string> = {
    pending: '待处理',
    reviewing: '复核中',
    confirmed: '已确认',
    exception: '异常',
  };
  const groupStatusMap: Record<string, string> = {
    pending: '待复核',
    confirmed: '已确认',
    rejected: '已拒绝',
  };

  const data = records.map((record) => {
    const group = record.groupId ? groupMap.get(record.groupId) : undefined;
    return {
      原始行号: record.originalRowNumber,
      现场名: record.liveName,
      版权名: record.copyrightName,
      情绪标签: record.emotionTag,
      置信度: (record.emotionConfidence * 100).toFixed(0) + '%',
      处理状态: statusMap[record.status] || record.status,
      音频备注: record.audioNote,
      分组规范名: group?.canonicalName || '',
      分组状态: group ? groupStatusMap[group.reviewStatus] || group.reviewStatus : '',
      导入版本: record.importVersion,
    };
  });

  const dataHash = generateDataHash(records);
  data.push({
    原始行号: '' as unknown as number,
    现场名: '',
    版权名: '',
    情绪标签: '',
    置信度: '',
    处理状态: '',
    音频备注: '',
    分组规范名: '',
    分组状态: '数据哈希',
    导入版本: dataHash,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '情绪标签明细');

  const summaryData = [
    { 统计项: '总记录数', 数值: records.length },
    { 统计项: '已确认', 数值: records.filter((r) => r.status === 'confirmed').length },
    { 统计项: '待复核', 数值: records.filter((r) => r.status === 'reviewing').length },
    { 统计项: '待处理', 数值: records.filter((r) => r.status === 'pending').length },
    { 统计项: '异常', 数值: records.filter((r) => r.status === 'exception').length },
    { 统计项: '分组数', 数值: groups.filter((g) => g.reviewStatus === 'confirmed').length },
    { 统计项: '待复核分组', 数值: groups.filter((g) => g.reviewStatus === 'pending').length },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '统计汇总');

  XLSX.writeFile(wb, `音频样本情绪标签_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportWeeklyReport = (records: SongRecord[], groups: SongGroup[]): void => {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    reviewing: '复核中',
    confirmed: '已确认',
    exception: '异常',
  };

  const emotionCounts = new Map<string, number>();
  records.forEach((r) => {
    emotionCounts.set(r.emotionTag, (emotionCounts.get(r.emotionTag) || 0) + 1);
  });

  const reportData = [
    { 项目: '周报周期', 内容: `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} 至 ${new Date().toISOString().slice(0, 10)}` },
    { 项目: '生成时间', 内容: new Date().toLocaleString('zh-CN') },
    { 项目: '', 内容: '' },
    { 项目: '一、总体统计', 内容: '' },
    { 项目: '总记录数', 内容: String(records.length) },
    { 项目: '已确认', 内容: String(records.filter((r) => r.status === 'confirmed').length) },
    { 项目: '待复核', 内容: String(records.filter((r) => r.status === 'reviewing').length) },
    { 项目: '待处理', 内容: String(records.filter((r) => r.status === 'pending').length) },
    { 项目: '异常', 内容: String(records.filter((r) => r.status === 'exception').length) },
    { 项目: '', 内容: '' },
    { 项目: '二、情绪分布', 内容: '' },
    ...Array.from(emotionCounts.entries()).map(([tag, count]) => ({
      项目: tag,
      内容: String(count),
    })),
    { 项目: '', 内容: '' },
    { 项目: '三、同名分组', 内容: '' },
    { 项目: '总分组数', 内容: String(groups.length) },
    { 项目: '已确认分组', 内容: String(groups.filter((g) => g.reviewStatus === 'confirmed').length) },
    { 项目: '待复核分组', 内容: String(groups.filter((g) => g.reviewStatus === 'pending').length) },
  ];

  const ws = XLSX.utils.json_to_sheet(reportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '周报');

  const detailData = records.map((record) => ({
    原始行号: record.originalRowNumber,
    现场名: record.liveName,
    版权名: record.copyrightName,
    情绪标签: record.emotionTag,
    处理状态: statusMap[record.status] || record.status,
    音频备注: record.audioNote,
  }));
  const wsDetail = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, wsDetail, '明细数据');

  XLSX.writeFile(wb, `情绪标签周报_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const getDataHash = generateDataHash;
