import { db } from '../db';
import { TicketType, RevenueSplitResult, DataSource } from '../types';

const VENUE_SPLIT_RATIO = 0.3;
const ARTIST_SPLIT_RATIO = 0.7;
const BAR_REVENUE_RATIO = 0.25;

function getRecordsForCalculation(batchId: number, useSource?: DataSource): { records: any[], authoritativeSource: string | null } {
  const canonicalCount = db.prepare('SELECT COUNT(*) as cnt FROM canonical_tickets WHERE batch_id = ?').get(batchId) as any;
  if (canonicalCount.cnt > 0) {
    const batch = db.prepare('SELECT authoritative_source FROM show_batches WHERE id = ?').get(batchId) as any;
    const records = db.prepare('SELECT * FROM canonical_tickets WHERE batch_id = ?').all(batchId);
    return { records, authoritativeSource: batch?.authoritative_source || 'canonical_tickets' };
  }

  let recordsQuery = `
    SELECT tr.* FROM ticket_records tr
    INNER JOIN (
      SELECT source, MAX(import_version) as max_v 
      FROM ticket_records WHERE batch_id = ? GROUP BY source
    ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
    WHERE tr.batch_id = ?
  `;
  const queryParams: any[] = [batchId, batchId];

  if (useSource) {
    recordsQuery += ' AND tr.source = ?';
    queryParams.push(useSource);
  }

  const records = db.prepare(recordsQuery).all(...queryParams);
  return { records, authoritativeSource: useSource || null };
}

export function calculateRevenueSplit(batchId: number, useSource?: DataSource): RevenueSplitResult {
  const batch = db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const { records, authoritativeSource } = getRecordsForCalculation(batchId, useSource);

  let totalPaidTickets = 0;
  let totalCompTickets = 0;
  let totalRevenue = 0;

  for (const record of records) {
    if (record.ticket_type === TicketType.PAID) {
      totalPaidTickets += record.quantity;
      totalRevenue += record.price * record.quantity;
    } else if (record.ticket_type === TicketType.COMP) {
      totalCompTickets += record.quantity;
    }
  }

  const totalTickets = totalPaidTickets + totalCompTickets;
  const barRevenue = totalRevenue * BAR_REVENUE_RATIO;
  const netRevenue = totalRevenue - barRevenue;
  const venueSplit = netRevenue * VENUE_SPLIT_RATIO;
  const artistSplit = netRevenue * ARTIST_SPLIT_RATIO;

  const existingResult = db.prepare(`
    SELECT MAX(version) as max_version FROM revenue_split_results WHERE batch_id = ?
  `).get(batchId) as any;
  const newVersion = (existingResult?.max_version || 0) + 1;

  db.prepare(`
    INSERT INTO revenue_split_results 
    (batch_id, authoritative_source, total_tickets, total_paid_tickets, total_comp_tickets, 
     total_revenue, bar_revenue, venue_split, artist_split, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batchId,
    authoritativeSource,
    totalTickets,
    totalPaidTickets,
    totalCompTickets,
    totalRevenue,
    barRevenue,
    venueSplit,
    artistSplit,
    newVersion
  );

  db.prepare(`
    UPDATE show_batches SET updated_at = datetime('now') WHERE id = ?
  `).run(batchId);

  return getLatestRevenueSplit(batchId)!;
}

export function getLatestRevenueSplit(batchId: number): RevenueSplitResult | null {
  const result = db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC, calculated_at DESC 
    LIMIT 1
  `).get(batchId) as any;

  if (!result) return null;

  return {
    id: result.id,
    batchId: result.batch_id,
    totalTickets: result.total_tickets,
    totalPaidTickets: result.total_paid_tickets,
    totalCompTickets: result.total_comp_tickets,
    totalRevenue: result.total_revenue,
    barRevenue: result.bar_revenue,
    venueSplit: result.venue_split,
    artistSplit: result.artist_split,
    calculatedAt: result.calculated_at,
    version: result.version
  } as RevenueSplitResult & { authoritativeSource?: string | null };
}

export function getRevenueSplitHistory(batchId: number): (RevenueSplitResult & { authoritativeSource?: string | null })[] {
  const results = db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC, calculated_at DESC
  `).all(batchId) as any[];

  return results.map((result: any) => ({
    id: result.id,
    batchId: result.batch_id,
    totalTickets: result.total_tickets,
    totalPaidTickets: result.total_paid_tickets,
    totalCompTickets: result.total_comp_tickets,
    totalRevenue: result.total_revenue,
    barRevenue: result.bar_revenue,
    venueSplit: result.venue_split,
    artistSplit: result.artist_split,
    calculatedAt: result.calculated_at,
    version: result.version,
    authoritativeSource: result.authoritative_source
  }));
}
