import { db } from '../db';
import { getLatestRevenueSplit, getRevenueSplitHistory } from './revenueService';
import { getConflicts, getCanonicalTickets } from './conflictService';
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
    authoritativeSource: string | null;
    createdAt: string;
    updatedAt: string;
  };
  tickets: {
    soundEngineer: any[];
    rehearsalGroup: any[];
    canonical: any[];
  };
  revenueSplit: any | null;
  revenueSplitHistory: any[];
  conflicts: any[];
  selfCheckResults: any[];
}

function getLatestBySource(batchId: number, source: DataSource): any[] {
  return db.prepare(`
    SELECT tr.* FROM ticket_records tr
    INNER JOIN (
      SELECT MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? AND source = ?
    ) latest ON tr.import_version = latest.max_v
    WHERE tr.batch_id = ? AND tr.source = ?
    ORDER BY tr.id
  `).all(batchId, source, batchId, source);
}

export function getUnifiedBatchResult(batchId: number): UnifiedBatchResult {
  const batch = db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId) as any;
  
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const soundEngineerTickets = getLatestBySource(batchId, DataSource.SOUND_ENGINEER);
  const rehearsalGroupTickets = getLatestBySource(batchId, DataSource.REHEARSAL_GROUP);
  const canonicalTickets = getCanonicalTickets(batchId);

  const revenueSplit = getLatestRevenueSplit(batchId);
  const revenueSplitHistory = getRevenueSplitHistory(batchId);
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
      authoritativeSource: batch.authoritative_source,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    },
    tickets: {
      soundEngineer: soundEngineerTickets,
      rehearsalGroup: rehearsalGroupTickets,
      canonical: canonicalTickets
    },
    revenueSplit,
    revenueSplitHistory,
    conflicts,
    selfCheckResults
  };
}

export function exportBatchData(batchId: number): any {
  const unified = getUnifiedBatchResult(batchId);
  
  return {
    exportVersion: '2.0',
    exportedAt: new Date().toISOString(),
    exportSource: 'canonical_tickets',
    authoritativeSource: unified.batch.authoritativeSource,
    ...unified
  };
}

export function getBatchList(): any[] {
  const batches = db.prepare(`
    SELECT * FROM show_batches 
    ORDER BY created_at DESC
  `).all() as any[];

  return batches.map(batch => {
    const canonicalCount = db.prepare('SELECT COUNT(*) as cnt FROM canonical_tickets WHERE batch_id = ?').get(batch.id) as any;

    let totalTickets = 0;
    let paidCount = 0;
    let compCount = 0;

    if (canonicalCount.cnt > 0) {
      const summary = db.prepare(`
        SELECT ticket_type, SUM(quantity) as qty FROM canonical_tickets WHERE batch_id = ? GROUP BY ticket_type
      `).all(batch.id) as any[];
      for (const s of summary) {
        if (s.ticket_type === TicketType.PAID) paidCount = s.qty;
        else if (s.ticket_type === TicketType.COMP) compCount = s.qty;
      }
      totalTickets = paidCount + compCount;
    } else {
      const rawSummary = db.prepare(`
        SELECT tr.ticket_type, SUM(tr.quantity) as qty
        FROM ticket_records tr
        INNER JOIN (
          SELECT source, MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? GROUP BY source
        ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
        WHERE tr.batch_id = ?
        GROUP BY tr.ticket_type
      `).all(batch.id, batch.id) as any[];
      for (const s of rawSummary) {
        if (s.ticket_type === TicketType.PAID) paidCount = s.qty;
        else if (s.ticket_type === TicketType.COMP) compCount = s.qty;
      }
      totalTickets = paidCount + compCount;
    }

    return {
      id: batch.id,
      batchDate: batch.batch_date,
      showName: batch.show_name,
      status: batch.status,
      hasMixedTickets: batch.has_mixed_tickets === 1,
      needsReview: batch.needs_review === 1,
      authoritativeSource: batch.authoritative_source,
      hasCanonicalTickets: canonicalCount.cnt > 0,
      totalTickets,
      paidTickets: paidCount,
      compTickets: compCount,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    };
  });
}
