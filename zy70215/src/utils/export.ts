import * as XLSX from 'xlsx';
import type { DataState, Screening, CleaningTask, LostItem, EquipmentIssue } from '../types';
import { getLastExportHash, setLastExportHash } from './storage';

export function calculateDataHash(state: DataState): string {
  const data = {
    screenings: state.screenings.map(s => ({ id: s.id, status: 'imported' })),
    cleaningTasks: state.cleaningTasks.map(t => ({ id: t.id, status: t.status })),
    lostItems: state.lostItems.map(l => ({ id: l.id, status: l.status })),
    equipmentIssues: state.equipmentIssues.map(e => ({ id: e.id, status: e.status })),
  };
  return JSON.stringify(data);
}

export function hasDataChanged(state: DataState): boolean {
  const currentHash = calculateDataHash(state);
  const lastHash = getLastExportHash();
  return currentHash !== lastHash;
}

export function prepareExport(state: DataState) {
  const screeningRows = state.screenings.map((s: Screening) => ({
    '排片ID': s.id,
    '影厅': s.hallNumber,
    '影片': s.movieName,
    '日期': s.date,
    '开始时间': s.startTime,
    '结束时间': s.endTime,
    '观众人数': s.audienceCount,
  }));

  const taskRows = state.cleaningTasks.map((t: CleaningTask) => ({
    '任务ID': t.id,
    '排片ID': t.screeningId,
    '影厅': t.hallNumber,
    '影片': t.movieName,
    '散场时间': t.screeningEndTime,
    '下一场开始': t.nextScreeningStartTime || '-',
    '截止时间': t.deadline,
    '状态': {
      'pending': '待开始',
      'in_progress': '进行中',
      'completed': '已完成',
      'overdue': '超时',
    }[t.status],
    '责任人': t.assignedTo,
    '开始时间': t.startTime || '-',
    '结束时间': t.endTime || '-',
    '质量评分': t.qualityScore || '-',
    '备注': t.notes || '',
  }));

  const lostItemRows = state.lostItems.map((l: LostItem) => ({
    '遗失物ID': l.id,
    '排片ID': l.screeningId,
    '清洁任务ID': l.cleaningTaskId,
    '影厅': l.hallNumber,
    '物品名称': l.itemName,
    '描述': l.description,
    '发现位置': l.foundLocation,
    '发现人': l.foundBy,
    '发现时间': l.foundTime,
    '状态': {
      'held': '待认领',
      'claimed': '已认领',
      'disposed': '已处理',
    }[l.status],
    '认领人': l.claimant || '-',
    '联系方式': l.claimantContact || '-',
    '认领时间': l.claimedTime || '-',
    '备注': l.notes || '',
  }));

  const equipmentRows = state.equipmentIssues.map((e: EquipmentIssue) => ({
    '设备异常ID': e.id,
    '排片ID': e.screeningId,
    '清洁任务ID': e.cleaningTaskId,
    '影厅': e.hallNumber,
    '设备类型': e.equipmentType,
    '问题描述': e.description,
    '上报人': e.reportedBy,
    '上报时间': e.reportedTime,
    '优先级': {
      'low': '低',
      'medium': '中',
      'high': '高',
      'critical': '紧急',
    }[e.priority],
    '状态': {
      'reported': '已上报',
      'in_progress': '处理中',
      'resolved': '已解决',
      'escalated': '已升级',
    }[e.status],
    '处理人': e.resolvedBy || '-',
    '处理时间': e.resolvedTime || '-',
    '处理备注': e.resolutionNotes || '',
  }));

  return {
    screenings: screeningRows,
    tasks: taskRows,
    lostItems: lostItemRows,
    equipment: equipmentRows,
  };
}

export function exportToExcel(state: DataState): void {
  const data = prepareExport(state);

  const wb = XLSX.utils.book_new();

  if (data.screenings.length > 0) {
    const ws1 = XLSX.utils.json_to_sheet(data.screenings);
    XLSX.utils.book_append_sheet(wb, ws1, '排片信息');
  }

  if (data.tasks.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(data.tasks);
    XLSX.utils.book_append_sheet(wb, ws2, '清洁任务');
  }

  if (data.lostItems.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(data.lostItems);
    XLSX.utils.book_append_sheet(wb, ws3, '遗失物登记');
  }

  if (data.equipment.length > 0) {
    const ws4 = XLSX.utils.json_to_sheet(data.equipment);
    XLSX.utils.book_append_sheet(wb, ws4, '设备异常');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `影院清洁交接记录_${timestamp}.xlsx`);

  setLastExportHash(calculateDataHash(state));
}
