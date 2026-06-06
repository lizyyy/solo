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

  let recordsImported = 0;
  let duplicatesFound = 0;
  const warnings: string[] = [];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO ticket_records 
    (batch_id, source, ticket_type, ticket_number, attendee_name, price, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkDuplicateStmt = db.prepare(`
    SELECT id FROM ticket_records 
    WHERE batch_id = ? AND source = ? AND ticket_number = ? AND attendee_name = ?
  `);

  const transaction = db.transaction(() => {
    for (const ticket of tickets) {
      if (ticket.ticketNumber || ticket.attendeeName) {
        const existing = checkDuplicateStmt.get(
          batchId,
          source,
          ticket.ticketNumber || null,
          ticket.attendeeName || null
        );
        if (existing) {
          duplicatesFound++;
          warnings.push(`重复记录: ${ticket.ticketNumber || ticket.attendeeName}`);
          continue;
        }
      }

      const result = insertStmt.run(
        batchId,
        source,
        ticket.ticketType,
        ticket.ticketNumber || null,
        ticket.attendeeName || null,
        ticket.price,
        ticket.quantity,
        ticket.notes || null
      );

      if (result.changes > 0) {
        recordsImported++;
      } else {
        duplicatesFound++;
      }
    }
  });

  transaction();

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
    SELECT ticket_type, COUNT(*) as count 
    FROM ticket_records 
    WHERE batch_id = ?
    GROUP BY ticket_type
  `).all(batchId) as any[];

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
