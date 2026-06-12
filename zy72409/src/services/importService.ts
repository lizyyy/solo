import { db } from '../db';
import { DataSource, TicketType, ImportResult, BatchStatus } from '../types';
import { detectConflicts } from './conflictService';

interface TicketImportItem {
  ticketType: TicketType;
  ticketNumber?: string;
  attendeeName?: string;
  price: number;
  quantity: number;
  notes?: string;
}

export function getLatestImportVersion(batchId: number, source: DataSource): number {
  const row = db.prepare(`
    SELECT MAX(import_version) as v FROM ticket_records WHERE batch_id = ? AND source = ?
  `).get(batchId, source) as any;
  return row?.v || 0;
}

export function importSoundEngineerRecords(
  batchId: number,
  tickets: TicketImportItem[]
): ImportResult {
  return importTickets(batchId, DataSource.SOUND_ENGINEER, tickets);
}

export function importRehearsalGroupRecords(
  batchId: number,
  tickets: TicketImportItem[]
): ImportResult {
  return importTickets(batchId, DataSource.REHEARSAL_GROUP, tickets);
}

function importTickets(
  batchId: number,
  source: DataSource,
  tickets: TicketImportItem[]
): ImportResult {
  const batch = db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const previousVersion = getLatestImportVersion(batchId, source);
  const importVersion = previousVersion + 1;

  let recordsImported = 0;
  let duplicatesFound = 0;
  const warnings: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO ticket_records 
    (batch_id, source, import_version, ticket_type, ticket_number, attendee_name, price, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkSameVersionDuplicate = db.prepare(`
    SELECT id FROM ticket_records 
    WHERE batch_id = ? AND source = ? AND import_version = ? AND ticket_number = ? AND attendee_name = ?
  `);

  const transaction = db.transaction(() => {
    for (const ticket of tickets) {
      if (ticket.ticketNumber || ticket.attendeeName) {
        const existing = checkSameVersionDuplicate.get(
          batchId,
          source,
          importVersion,
          ticket.ticketNumber || null,
          ticket.attendeeName || null
        );
        if (existing) {
          duplicatesFound++;
          warnings.push(`本次导入内重复记录: ${ticket.ticketNumber || ticket.attendeeName}`);
          continue;
        }
      }

      insertStmt.run(
        batchId,
        source,
        importVersion,
        ticket.ticketType,
        ticket.ticketNumber || null,
        ticket.attendeeName || null,
        ticket.price,
        ticket.quantity,
        ticket.notes || null
      );
      recordsImported++;
    }
  });

  transaction();

  if (previousVersion > 0) {
    warnings.push(`检测到历史导入版本：本次为 v${importVersion}，历史版本 v${previousVersion} 已归档`);
  }

  updateBatchStatusAfterImport(batchId);

  const conflicts = detectConflicts(batchId);

  if (conflicts.length > 0) {
    db.prepare('UPDATE show_batches SET needs_review = 1, status = ? WHERE id = ?').run(
      BatchStatus.PENDING_REVIEW,
      batchId
    );
  }

  return {
    batchId,
    recordsImported,
    duplicatesFound,
    warnings,
    conflicts
  };
}

function updateBatchStatusAfterImport(batchId: number) {
  const records = db.prepare(`
    SELECT ticket_type, SUM(quantity) as count 
    FROM ticket_records tr
    INNER JOIN (
      SELECT source, MAX(import_version) as max_v 
      FROM ticket_records WHERE batch_id = ? GROUP BY source
    ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
    WHERE tr.batch_id = ?
    GROUP BY ticket_type
  `).all(batchId, batchId) as any[];

  const hasPaid = records.some(r => r.ticket_type === TicketType.PAID);
  const hasComp = records.some(r => r.ticket_type === TicketType.COMP);
  const hasMixed = hasPaid && hasComp;

  db.prepare(`
    UPDATE show_batches 
    SET has_mixed_tickets = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(hasMixed ? 1 : 0, batchId);

  if (hasMixed) {
    db.prepare('UPDATE show_batches SET status = ? WHERE id = ?').run(
      BatchStatus.NEEDS_AUDIO_ENGINEER_REVIEW,
      batchId
    );
  }
}

export function createBatch(batchDate: string, showName: string): number {
  const result = db.prepare(`
    INSERT INTO show_batches (batch_date, show_name, status)
    VALUES (?, ?, ?)
  `).run(batchDate, showName, BatchStatus.DRAFT);

  return Number(result.lastInsertRowid);
}
