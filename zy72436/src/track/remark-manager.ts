import { dataStore } from '../store/data-store';
import { TrackRemark, TrackRemarkType, ProcessingStatus } from '../types';

export function addTrackRemark(
  ticketRowId: string,
  type: TrackRemarkType,
  content: string,
  addedBy: string,
  isReworkReason: boolean = false,
  retainReason?: string
): TrackRemark | null {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return null;

  const remark: TrackRemark = {
    id: dataStore.generateId(),
    trackId: row.trackId,
    type,
    content,
    addedBy,
    addedAt: new Date().toISOString(),
    isReworkReason,
    retainedBy: isReworkReason ? addedBy : undefined,
    retainReason: isReworkReason ? retainReason : undefined,
  };

  const newRemarks = [...row.trackRemarks, remark];
  
  let newStatus: ProcessingStatus = row.processingStatus;
  if (isReworkReason && row.processingStatus !== 'pending_review' && row.processingStatus !== 'reviewed_rework') {
    newStatus = 'rework_detected';
  }

  dataStore.updateTicketRow(ticketRowId, {
    trackRemarks: newRemarks,
    processingStatus: newStatus,
    lastUpdatedBy: addedBy,
  });

  return remark;
}

export function retainReworkRemark(
  ticketRowId: string,
  remarkId: string,
  retainedBy: string,
  retainReason: string
): boolean {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return false;

  const remark = row.trackRemarks.find(r => r.id === remarkId);
  if (!remark || !remark.isReworkReason) return false;

  const newRemarks = row.trackRemarks.map(r =>
    r.id === remarkId
      ? { ...r, retainedBy, retainReason }
      : r
  );

  dataStore.updateTicketRow(ticketRowId, {
    trackRemarks: newRemarks,
    processingStatus: 'pending_review',
    lastUpdatedBy: retainedBy,
  });

  return true;
}

export function reviewReworkRemark(
  ticketRowId: string,
  remarkId: string,
  reviewedBy: string,
  approveAsNormal: boolean
): boolean {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return false;

  const remark = row.trackRemarks.find(r => r.id === remarkId);
  if (!remark || !remark.isReworkReason) return false;

  const newStatus: ProcessingStatus = approveAsNormal ? 'reviewed_normal' : 'reviewed_rework';

  dataStore.updateTicketRow(ticketRowId, {
    processingStatus: newStatus,
    lastUpdatedBy: reviewedBy,
  });

  return true;
}

export function getTrackRemarksWithRework(ticketRowId: string): TrackRemark[] {
  const row = dataStore.getTicketRow(ticketRowId);
  if (!row) return [];
  return row.trackRemarks.filter(r => r.isReworkReason);
}
