import { dataStore } from '../store/data-store';
import { TicketRow, TrackRemark, RehearsalChange } from '../types';

export interface TicketRowView {
  id: string;
  originalRowNumber: number;
  studentName: string;
  instrument: string;
  trackId: string;
  currentClass?: string;
  processingStatus: string;
  audioFileRemark?: string;
  audioRemarkAddedBy?: string;
  audioRemarkAddedAt?: string;
  hasReworkReason: boolean;
  reworkRemarks: Array<{
    id: string;
    content: string;
    addedBy: string;
    addedAt: string;
    retainedBy?: string;
    retainReason?: string;
  }>;
  rehearsalChangeCount: number;
  manualChangeCount: number;
  importedAt: string;
  importedBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export interface TicketRowDetailView extends TicketRowView {
  rawData: Record<string, string>;
  manualChanges: Array<{
    changedAt: string;
    changedBy: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    reason: string;
  }>;
  trackRemarks: Array<{
    id: string;
    type: string;
    content: string;
    addedBy: string;
    addedAt: string;
    isReworkReason: boolean;
    retainedBy?: string;
    retainReason?: string;
  }>;
  rehearsalChanges: Array<{
    id: string;
    changeType: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: string;
    reason: string;
  }>;
}

function toTicketRowView(row: TicketRow): TicketRowView {
  const reworkRemarks = row.trackRemarks
    .filter(r => r.isReworkReason)
    .map(r => ({
      id: r.id,
      content: r.content,
      addedBy: r.addedBy,
      addedAt: r.addedAt,
      retainedBy: r.retainedBy,
      retainReason: r.retainReason,
    }));

  return {
    id: row.id,
    originalRowNumber: row.originalRowNumber,
    studentName: row.studentName,
    instrument: row.instrument,
    trackId: row.trackId,
    currentClass: row.currentClass,
    processingStatus: row.processingStatus,
    audioFileRemark: row.audioFileRemark,
    audioRemarkAddedBy: row.audioRemarkAddedBy,
    audioRemarkAddedAt: row.audioRemarkAddedAt,
    hasReworkReason: reworkRemarks.length > 0,
    reworkRemarks,
    rehearsalChangeCount: row.rehearsalChanges.length,
    manualChangeCount: row.manualChanges.length,
    importedAt: row.importedAt,
    importedBy: row.importedBy,
    lastUpdatedAt: row.lastUpdatedAt,
    lastUpdatedBy: row.lastUpdatedBy,
  };
}

function toTicketRowDetailView(row: TicketRow): TicketRowDetailView {
  const base = toTicketRowView(row);
  return {
    ...base,
    rawData: row.rawData,
    manualChanges: row.manualChanges,
    trackRemarks: row.trackRemarks.map(r => ({
      id: r.id,
      type: r.type,
      content: r.content,
      addedBy: r.addedBy,
      addedAt: r.addedAt,
      isReworkReason: r.isReworkReason,
      retainedBy: r.retainedBy,
      retainReason: r.retainReason,
    })),
    rehearsalChanges: row.rehearsalChanges.map(c => ({
      id: c.id,
      changeType: c.changeType,
      oldValue: c.oldValue,
      newValue: c.newValue,
      changedBy: c.changedBy,
      changedAt: c.changedAt,
      reason: c.reason,
    })),
  };
}

export function getAllTicketRowViews(): TicketRowView[] {
  return dataStore.getAllTicketRows().map(toTicketRowView);
}

export function getTicketRowDetailView(id: string): TicketRowDetailView | null {
  const row = dataStore.getTicketRow(id);
  if (!row) return null;
  return toTicketRowDetailView(row);
}

export function getTicketRowViewsByBatch(batchId: string): TicketRowView[] {
  return dataStore.getTicketRowsByBatch(batchId).map(toTicketRowView);
}

export function getRehearsalChangeDetail(rowId: string, changeId: string): RehearsalChange | null {
  const row = dataStore.getTicketRow(rowId);
  if (!row) return null;
  return row.rehearsalChanges.find(c => c.id === changeId) || null;
}

export function getExportRows(): Array<Record<string, string>> {
  const rows = dataStore.getAllTicketRows();
  return rows.map(row => {
    const reworkRemarkContents = row.trackRemarks
      .filter(r => r.isReworkReason)
      .map(r => r.content)
      .join('; ');
    
    return {
      '原始行号': String(row.originalRowNumber),
      '学生姓名': row.studentName,
      '乐器': row.instrument,
      '轨道编号': row.trackId,
      '分班结果': row.currentClass || '',
      '处理状态': row.processingStatus,
      '音频文件备注': row.audioFileRemark || '',
      '含返工原因': row.trackRemarks.some(r => r.isReworkReason) ? '是' : '否',
      '返工原因详情': reworkRemarkContents,
      '排练变更次数': String(row.rehearsalChanges.length),
      '人工改动次数': String(row.manualChanges.length),
      '导入时间': row.importedAt,
      '最后更新时间': row.lastUpdatedAt,
    };
  });
}
