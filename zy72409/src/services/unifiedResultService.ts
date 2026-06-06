import { db } from '../db';
import { getLatestRevenueSplit } from './revenueService';
import { getConflicts } from './conflictService';
import { runAllChecks } from './selfCheckService';
import { TicketType, DataSource } from '../types';

export interface UnifiedBatchResult {
  batch: {
    id: number;
    batchDate: string;
    showName: string;
    status: string;
    hasMixedTickets: boolean;
    needsReview: boolean;
    createdAt: string;
    updatedAt: string;
  };
  tickets: {
    soundEngineer: any[];
    rehearsalGroup: any[];
  };
  revenueSplit: any | null;
  conflicts: any[];
  selfCheckResults: any[];
}

export function getUnifiedBatchResult(batchId: number): UnifiedBatchResult {
  const batch = db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId) as any;
  
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const soundEngineerTickets = db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
    ORDER BY id
  `).all(batchId, DataSource.SOUND_ENGINEER);

  const rehearsalGroupTickets = db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
    ORDER BY id
  `).all(batchId, DataSource.REHEARSAL_GROUP);

  const revenueSplit = getLatestRevenueSplit(batchId);
  const conflicts = getConflicts(batchId);
  const selfCheckResults = runAllChecks(batchId);

  return {
    batch: {
      id: batch.id,
      batchDate: batch.batch_date,
      showName: batch.show_name,
      status: batch.status,
      hasMixedTickets: batch.has_mixed_tickets === 1,
      needsReview: batch.needs_review === 1,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    },
    tickets: {
      soundEngineer: soundEngineerTickets,
      rehearsalGroup: rehearsalGroupTickets
    },
    revenueSplit,
    conflicts,
    selfCheckResults
  };
}

export function exportBatchData(batchId: number): any {
  const unified = getUnifiedBatchResult(batchId);
  
  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    ...unified
  };
}

export function getBatchList(): any[] {
  const batches = db.prepare(`
    SELECT * FROM show_batches 
    ORDER BY created_at DESC
  `).all() as any[];

  return batches.map(batch => {
    const ticketCounts = db.prepare(`
      SELECT source, ticket_type, SUM(quantity) as qty
      FROM ticket_records 
      WHERE batch_id = ?
      GROUP BY source, ticket_type
    `).all(batch.id) as any[];

    const totalTickets = ticketCounts.reduce((sum, t) => sum + t.qty, 0);
    
    return {
      id: batch.id,
      batchDate: batch.batch_date,
      showName: batch.show_name,
      status: batch.status,
      hasMixedTickets: batch.has_mixed_tickets === 1,
      needsReview: batch.needs_review === 1,
      totalTickets,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    };
  });
}
