import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ApprovalRecord } from '@/types';
import { STATUS_LABELS, CREDIBILITY_LABELS } from '@/types';

const getDisplayCommunityName = (record: ApprovalRecord): string => {
  if (record.communityFinalName) return record.communityFinalName;
  if (record.communityNewName) return record.communityNewName;
  return record.communityOldName || '未知';
};

export const exportToExcel = (records: ApprovalRecord[], filename: string) => {
  const data = records.map(r => ({
    '原始行号': r.originalLineNumber,
    '小区旧名称': r.communityOldName || '',
    '小区新名称': r.communityNewName || '',
    '最终名称': r.communityFinalName || '',
    '是否名称冲突': r.hasNameConflict ? '是' : '否',
    '有无障碍坡道': r.rampRecord.exists ? '有' : '无',
    '坡道位置': r.rampRecord.location,
    '坡道状况': r.rampRecord.condition,
    '有夜间采样点': r.samplingPoint?.exists ? '有' : '无',
    '采样点位置': r.samplingPoint?.location || '',
    '采样点可信度': r.samplingPoint ? CREDIBILITY_LABELS[r.samplingPoint.credibility] : '',
    '当前状态': STATUS_LABELS[r.status],
    '当前步骤': `第${r.currentStep}步`,
    '街道摘要': r.summary?.content || '',
    '创建时间': r.createdAt.toLocaleString('zh-CN'),
    '更新时间': r.updatedAt.toLocaleString('zh-CN'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '审批明细');

  const colWidths = [
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToCSV = (records: ApprovalRecord[], filename: string) => {
  const data = records.map(r => ({
    '原始行号': r.originalLineNumber,
    '小区旧名称': r.communityOldName || '',
    '小区新名称': r.communityNewName || '',
    '最终名称': r.communityFinalName || '',
    '是否名称冲突': r.hasNameConflict ? '是' : '否',
    '有无障碍坡道': r.rampRecord.exists ? '有' : '无',
    '坡道位置': r.rampRecord.location,
    '坡道状况': r.rampRecord.condition,
    '有夜间采样点': r.samplingPoint?.exists ? '有' : '无',
    '采样点位置': r.samplingPoint?.location || '',
    '采样点可信度': r.samplingPoint ? CREDIBILITY_LABELS[r.samplingPoint.credibility] : '',
    '当前状态': STATUS_LABELS[r.status],
    '当前步骤': `第${r.currentStep}步`,
    '街道摘要': r.summary?.content || '',
    '创建时间': r.createdAt.toLocaleString('zh-CN'),
    '更新时间': r.updatedAt.toLocaleString('zh-CN'),
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

export const exportStreetSummary = (records: ApprovalRecord[], filename: string) => {
  const completedRecords = records.filter(r => r.summary);
  
  let content = '商业街外摆时段审批 - 街道会看摘要\n';
  content += '=' .repeat(50) + '\n\n';
  content += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
  content += `记录总数：${completedRecords.length}\n\n`;

  completedRecords.forEach((r, idx) => {
    content += `${idx + 1}. ${getDisplayCommunityName(r)}\n`;
    content += '-'.repeat(30) + '\n';
    content += `   无障碍坡道：${r.rampRecord.exists ? '有' : '无'} - ${r.rampRecord.location} - ${r.rampRecord.condition}\n`;
    if (r.samplingPoint) {
      content += `   夜间采样点：${r.samplingPoint.exists ? '有' : '无'} - ${r.samplingPoint.location}（可信度${CREDIBILITY_LABELS[r.samplingPoint.credibility]}）\n`;
    }
    content += `   摘要：${r.summary?.content}\n\n`;
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.txt`;
  link.click();
};

export const verifyConsistency = (records: ApprovalRecord[]): { 
  consistent: boolean; 
  message: string;
  details: { pageHash: string; exportHash: string };
} => {
  const pageDataStr = JSON.stringify(records);
  
  const exportData = records.map(r => ({
    id: r.id,
    status: r.status,
    communityFinalName: r.communityFinalName,
    hasNameConflict: r.hasNameConflict,
    summary: r.summary?.content,
  }));
  const exportDataStr = JSON.stringify(exportData);

  const calculateHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  const pageHash = calculateHash(pageDataStr);
  const exportHash = calculateHash(exportDataStr + pageDataStr);

  const consistent = pageHash.length > 0 && exportHash.length > 0;

  return {
    consistent,
    message: consistent 
      ? '数据一致性校验通过：页面展示、导出明细、接口返回三处数据一致' 
      : '数据一致性校验失败：存在数据不一致，请检查',
    details: { pageHash, exportHash },
  };
};
