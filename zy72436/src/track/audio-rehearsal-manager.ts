import { dataStore } from '../store/data-store';
import { RehearsalChange, ProcessingStatus, ManualChange } from '../types';

export function addAudioFileRemark(
  ticketRowId: string,
  audioRemark: string,
  addedBy: string
): boolean {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return false;

  const now = new Date().toISOString();
  
  let manualChanges = [...row.manualChanges];
  if (row.audioFileRemark) {
    manualChanges.push({
      changedAt: now,
      changedBy: addedBy,
      fieldName: 'audioFileRemark',
      oldValue: row.audioFileRemark,
      newValue: audioRemark,
      reason: '音频文件备注补充更新',
    });
  }

  const hasRework = audioRemark.includes('返工') || audioRemark.includes('重录') || audioRemark.includes('不合格');
  let newStatus: ProcessingStatus = row.processingStatus;
  
  if (row.processingStatus === 'imported') {
    newStatus = hasRework ? 'rework_detected' : 'audio_remark_added';
  } else if (hasRework && row.processingStatus !== 'pending_review' && row.processingStatus !== 'reviewed_rework') {
    newStatus = 'rework_detected';
  }

  dataStore.updateTicketRow(ticketRowId, {
    audioFileRemark: audioRemark,
    audioRemarkAddedBy: addedBy,
    audioRemarkAddedAt: now,
    manualChanges,
    processingStatus: newStatus,
    lastUpdatedBy: addedBy,
  });

  return true;
}

export function addRehearsalChange(
  ticketRowId: string,
  changeType: RehearsalChange['changeType'],
  oldValue: string,
  newValue: string,
  reason: string,
  changedBy: string,
  relatedRemarkId?: string
): RehearsalChange | null {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return null;

  const change: RehearsalChange = {
    id: dataStore.generateId(),
    trackId: row.trackId,
    changeType,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
    reason,
    relatedRemarkId,
  };

  const newChanges = [...row.rehearsalChanges, change];
  
  let newStatus: ProcessingStatus = row.processingStatus;
  if (row.processingStatus === 'audio_remark_added' || row.processingStatus === 'reviewed_normal') {
    newStatus = 'rehearsal_updated';
  }

  dataStore.updateTicketRow(ticketRowId, {
    rehearsalChanges: newChanges,
    processingStatus: newStatus,
    lastUpdatedBy: changedBy,
  });

  return change;
}

export function addManualChange(
  ticketRowId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason: string,
  changedBy: string
): boolean {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return false;

  const change: ManualChange = {
    changedAt: new Date().toISOString(),
    changedBy,
    fieldName,
    oldValue,
    newValue,
    reason,
  };

  dataStore.updateTicketRow(ticketRowId, {
    manualChanges: [...row.manualChanges, change],
    lastUpdatedBy: changedBy,
  });

  return true;
}

export function getRehearsalChangeDetail(ticketRowId: string, changeId: string): RehearsalChange | null {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return null;
  return row.rehearsalChanges.find(c => c.id === changeId) || null;
}

export function getTracksWithRework(): string[] {
  const rows = dataStore.getAllTicketRows();
  const trackSet = new Set<string>();
  
  for (const row of rows) {
    const hasReworkRemark = row.trackRemarks.some(r => r.isReworkReason);
    const hasReworkAudio = row.audioFileRemark?.includes('返工') || row.audioFileRemark?.includes('重录');
    if (hasReworkRemark || hasReworkAudio) {
      trackSet.add(row.trackId);
    }
  }
  
  return Array.from(trackSet);
}
