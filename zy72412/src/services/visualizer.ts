import { getAllBatches, getTicketsByBatch, getBatchById } from './ticketImporter';
import { getAllReminders, getReminderByTicketId } from './authReminder';
import { getAudioFilesByBatch } from './audioManager';

export interface BatchVisualization {
  batchId: string;
  totalCount: number;
  paidCount: number;
  complimentaryCount: number;
  hasMixedTypes: boolean;
  reviewStatus: string;
  importDate: string;
  tickets: Array<{
    ticketId: number;
    ticketNo: string;
    ticketType: string;
    authStatus: string;
    attendeeName: string;
    audioRemark?: string;
    sourceLink: {
      type: 'ticket_export' | 'audio_file';
      reference: string;
    };
  }>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string[];
  }>;
}

export function getBatchVisualization(batchId: string): BatchVisualization | null {
  const batch = getBatchById(batchId);
  if (!batch) return null;

  const tickets = getTicketsByBatch(batchId);
  const audioFiles = getAudioFilesByBatch(batchId);
  const audioMap = new Map(audioFiles.map(a => [a.ticketNo, a]));

  return {
    batchId: batch.batchId,
    totalCount: batch.totalCount,
    paidCount: batch.paidCount,
    complimentaryCount: batch.complimentaryCount,
    hasMixedTypes: batch.hasMixedTypes,
    reviewStatus: batch.reviewStatus,
    importDate: batch.importDate,
    tickets: tickets.map(ticket => ({
      ticketId: ticket.id!,
      ticketNo: ticket.ticketNo,
      ticketType: ticket.ticketType,
      authStatus: ticket.authStatus,
      attendeeName: ticket.attendeeName,
      audioRemark: ticket.audioRemark,
      sourceLink: {
        type: audioMap.has(ticket.ticketNo) ? 'audio_file' : 'ticket_export',
        reference: audioMap.has(ticket.ticketNo) 
          ? `audio:${audioMap.get(ticket.ticketNo)!.fileId}` 
          : `batch:${batchId}`
      }
    }))
  };
}

export function getOverviewChartData(): ChartData {
  const batches = getAllBatches();
  
  const mixedCount = batches.filter(b => b.hasMixedTypes).length;
  const pureCount = batches.filter(b => !b.hasMixedTypes).length;
  const newCount = batches.filter(b => b.reviewStatus === 'new').length;
  const inReviewCount = batches.filter(b => b.reviewStatus === 'in_review').length;
  const reviewedCount = batches.filter(b => b.reviewStatus === 'reviewed').length;

  return {
    labels: ['混批批次', '纯批次', '待处理', '处理中', '已完成'],
    datasets: [{
      label: '数量',
      data: [mixedCount, pureCount, newCount, inReviewCount, reviewedCount],
      backgroundColor: [
        '#FF6B6B',
        '#4ECDC4',
        '#FFE66D',
        '#45B7D1',
        '#96CEB4'
      ]
    }]
  };
}

export interface AuthStatusSummary {
  pending: number;
  needs_review: number;
  audio_verified: number;
  approved: number;
  rejected: number;
}

export function getAuthStatusSummary(): AuthStatusSummary {
  const reminders = getAllReminders();
  return reminders.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as AuthStatusSummary) as AuthStatusSummary;
}

export interface TraceInfo {
  ticketNo: string;
  batchId: string;
  authTrail: Array<{
    status: string;
    reason: string;
    timestamp: string;
    assignee: string;
  }>;
  sourceReferences: Array<{
    type: string;
    reference: string;
    description: string;
  }>;
}

export function getTicketTrace(ticketId: number): TraceInfo | null {
  const reminders = getAllReminders().filter(r => r.ticketId === ticketId);
  if (reminders.length === 0) return null;

  const reminder = reminders[0];
  const audioFiles = getAudioFilesByBatch(reminder.batchId).filter(a => a.ticketNo === reminder.ticketNo);

  return {
    ticketNo: reminder.ticketNo,
    batchId: reminder.batchId,
    authTrail: reminders.map(r => ({
      status: r.status,
      reason: r.reason,
      timestamp: r.updatedAt,
      assignee: r.assignee
    })),
    sourceReferences: [
      {
        type: 'ticket_export',
        reference: `batch:${reminder.batchId}`,
        description: '票务导出表原始记录'
      },
      ...audioFiles.map(a => ({
        type: 'audio_file',
        reference: `audio:${a.fileId}`,
        description: `音频文件: ${a.fileName}${a.remark ? ` (备注: ${a.remark})` : ''}`
      }))
    ]
  };
}
