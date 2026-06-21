import * as XLSX from 'xlsx';
import type { AudioMaterial, ExceptionType, MaterialStatus } from '../types';
import { EXCEPTION_TYPES, STATUS_LABELS } from '../types';
import { countDuplicateGroups } from './detection';

const getExceptionLabels = (exceptions: { type: ExceptionType }[]): string => {
  return exceptions.map((e) => {
    const found = EXCEPTION_TYPES.find((t) => t.type === e.type);
    return found ? found.label : e.type;
  }).join('、') || '无';
};

interface ExportOptions {
  includeHeader?: boolean;
  sheetName?: string;
}

export const exportToExcel = (
  materials: AudioMaterial[],
  filename: string = '音频素材情绪标签复核清单',
  options: ExportOptions = {}
): void => {
  const { includeHeader = true, sheetName = '复核清单' } = options;

  const exportData = materials.map((m, index) => ({
    '序号': index + 1,
    '文件名': m.fileName,
    '曲目名称': m.trackName,
    '情绪标签': m.emotionTag || '未标注',
    '状态': STATUS_LABELS[m.status as MaterialStatus] || m.status,
    '来源': m.source,
    '处理备注': m.remark,
    '例外情况': getExceptionLabels(m.exceptions.filter(e => !e.resolved)),
    '已解决例外': getExceptionLabels(m.exceptions.filter(e => e.resolved)),
    '原始来源': m.originalSource,
    '处理人': m.processedBy,
    '处理时间': m.processedAt ? new Date(m.processedAt).toLocaleString('zh-CN') : '',
    '授权日期': m.authorizationDate ? new Date(m.authorizationDate).toLocaleDateString('zh-CN') : '',
    '时码': m.timecode || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: !includeHeader });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 25 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 15 },
    { wch: 30 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 18 },
  ];

  XLSX.writeFile(wb, `${filename}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`);
};

export const generateReportContent = (materials: AudioMaterial[]): string => {
  const total = materials.length;
  const reviewed = materials.filter((m) => m.status === 'reviewed' || m.status === 'resolved').length;
  const pending = materials.filter((m) => m.status === 'pending').length;
  const hasException = materials.filter((m) => m.status === 'exception').length;

  const authExpired = materials.filter((m) =>
    m.exceptions.some((e) => e.type === 'auth_expired' && !e.resolved)
  ).length;
  const timecodeMismatch = materials.filter((m) =>
    m.exceptions.some((e) => e.type === 'timecode_mismatch' && !e.resolved)
  ).length;
  const duplicateTrack = countDuplicateGroups(materials);

  const emotionStats: Record<string, number> = {};
  materials.forEach((m) => {
    const tag = m.emotionTag || '未标注';
    emotionStats[tag] = (emotionStats[tag] || 0) + 1;
  });

  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return `
音频素材情绪标签复核报告
生成时间：${new Date().toLocaleString('zh-CN')}

【复核进度】
总计：${total} 条
已完成复核：${reviewed} 条（${progress}%）
待复核：${pending} 条
存在异常：${hasException} 条

【异常统计】
授权过期：${authExpired} 条
时码错位：${timecodeMismatch} 条
重复曲目：${duplicateTrack} 组

【情绪标签分布】
${Object.entries(emotionStats)
  .map(([tag, count]) => `${tag}：${count} 条`)
  .join('\n')}

【备注】
- 本报告数据与导出明细完全一致
- 所有修改记录均已保留原始来源和处理时间
- 异常素材请优先处理，避免影响后续工作
`.trim();
};

export const downloadReport = (materials: AudioMaterial[]): void => {
  const content = generateReportContent(materials);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `音频素材情绪标签复核报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
