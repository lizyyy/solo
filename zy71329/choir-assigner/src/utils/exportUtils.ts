import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Member, VoicePart, Assignment, AdjustmentRecord, ConflictItem } from '../types';

interface ExportData {
  members: Member[];
  voiceParts: VoicePart[];
  assignments: Assignment[];
  adjustments: AdjustmentRecord[];
  globalConflicts: ConflictItem[];
  songName?: string;
  teacherNotes?: string;
}

export function exportToExcel(data: ExportData): void {
  const { members, voiceParts, assignments, adjustments, globalConflicts, songName, teacherNotes } = data;

  const wb = XLSX.utils.book_new();

  const assignmentData = assignments.map(a => {
    const member = members.find(m => m.id === a.memberId);
    const part = voiceParts.find(p => p.id === a.partId);
    return {
      '姓名': a.memberName,
      '性别': member?.gender === 'female' ? '女' : '男',
      '声部': part?.displayName || a.partName,
      '音域': member ? `${member.voiceRange.lowest} - ${member.voiceRange.highest}` : '-',
      '匹配度': `${Math.round(a.matchScore)}%`,
      '出勤率': member ? `${Math.round(member.attendance.rate * 100)}%` : '-',
      '是否资深': member?.isVeteran ? '是' : '否',
      '搭档': member?.bindPartnerName || '-',
      '手动调整': a.isManual ? '是' : '否',
      '异常': a.conflicts.length > 0 ? a.conflicts.map(c => c.message).join('; ') : '无',
      '备注': member?.notes || '',
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(assignmentData);
  XLSX.utils.book_append_sheet(wb, ws1, '声部分配');

  const partStats = voiceParts.map(part => {
    const partAssignments = assignments.filter(a => a.partId === part.id);
    const avgScore = partAssignments.length > 0 
      ? partAssignments.reduce((sum, a) => sum + a.matchScore, 0) / partAssignments.length 
      : 0;
    const veteranCount = partAssignments.filter(a => {
      const member = members.find(m => m.id === a.memberId);
      return member?.isVeteran;
    }).length;
    
    return {
      '声部': part.displayName,
      '当前人数': partAssignments.length,
      '理想人数': part.idealMembers,
      '人数范围': `${part.minMembers} - ${part.maxMembers}`,
      '平均匹配度': `${Math.round(avgScore)}%`,
      '资深团员': `${veteranCount}人`,
      '需资深': part.requiredVeterans ? `${part.requiredVeterans}人` : '-',
      '难度': part.difficulty === 'easy' ? '简单' : part.difficulty === 'medium' ? '中等' : '困难',
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(partStats);
  XLSX.utils.book_append_sheet(wb, ws2, '声部统计');

  if (globalConflicts.length > 0) {
    const conflictData = globalConflicts.map(c => ({
      '类型': getConflictTypeName(c.type),
      '级别': c.severity === 'error' ? '错误' : c.severity === 'warning' ? '警告' : '提示',
      '描述': c.message,
    }));
    const ws3 = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, ws3, '异常警告');
  }

  if (adjustments.length > 0) {
    const adjustmentData = adjustments.map(a => ({
      '时间': new Date(a.timestamp).toLocaleString('zh-CN'),
      '团员': a.memberName,
      '原声部': a.oldPartName,
      '新声部': a.newPartName,
      '原因': a.reason,
      '操作人': a.operator,
    }));
    const ws4 = XLSX.utils.json_to_sheet(adjustmentData);
    XLSX.utils.book_append_sheet(wb, ws4, '调整历史');
  }

  const infoData = [
    { '项目': '曲目名称', '内容': songName || '未命名' },
    { '项目': '导出时间', '内容': new Date().toLocaleString('zh-CN') },
    { '项目': '总人数', '内容': members.length },
    { '项目': '老师备注', '内容': teacherNotes || '无' },
  ];
  const ws5 = XLSX.utils.json_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, ws5, '基本信息');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const fileName = songName ? `声部分配_${songName}_${new Date().toISOString().split('T')[0]}.xlsx` : `声部分配_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, fileName);
}

function getConflictTypeName(type: string): string {
  const names: Record<string, string> = {
    OVERCAPACITY: '人数超出',
    UNDERCAPACITY: '人数不足',
    VOICE_MISMATCH: '音域不匹配',
    ABSENTEEISM: '出勤率低',
    PARTNER_SPLIT: '搭档被拆分',
    VETERAN_SHORTAGE: '资深团员不足',
    MANUAL_OVERRIDE: '手动调整',
  };
  return names[type] || type;
}

export function exportToCSV(assignments: Assignment[], members: Member[], voiceParts: VoicePart[]): void {
  const headers = ['姓名', '性别', '声部', '音域', '匹配度', '出勤率', '是否资深', '搭档', '备注'];
  const rows = assignments.map(a => {
    const member = members.find(m => m.id === a.memberId);
    const part = voiceParts.find(p => p.id === a.partId);
    return [
      a.memberName,
      member?.gender === 'female' ? '女' : '男',
      part?.displayName || a.partName,
      member ? `${member.voiceRange.lowest}-${member.voiceRange.highest}` : '-',
      `${Math.round(a.matchScore)}%`,
      member ? `${Math.round(member.attendance.rate * 100)}%` : '-',
      member?.isVeteran ? '是' : '否',
      member?.bindPartnerName || '-',
      member?.notes || '',
    ].join(',');
  });
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `声部分配_${new Date().toISOString().split('T')[0]}.csv`);
}
