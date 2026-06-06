"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSoundEngineerRecords = importSoundEngineerRecords;
exports.importRehearsalGroupRecords = importRehearsalGroupRecords;
exports.createBatch = createBatch;
const db_1 = require("../db");
const types_1 = require("../types");
const conflictService_1 = require("./conflictService");
function importSoundEngineerRecords(batchId, tickets) {
    return importTickets(batchId, types_1.DataSource.SOUND_ENGINEER, tickets);
}
function importRehearsalGroupRecords(batchId, tickets) {
    return importTickets(batchId, types_1.DataSource.REHEARSAL_GROUP, tickets);
}
function importTickets(batchId, source, tickets) {
    const batch = db_1.db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId);
    if (!batch) {
        throw new Error(`批次 ${batchId} 不存在`);
    }
    let recordsImported = 0;
    let duplicatesFound = 0;
    const warnings = [];
    const insertStmt = db_1.db.prepare(`
    INSERT OR IGNORE INTO ticket_records 
    (batch_id, source, ticket_type, ticket_number, attendee_name, price, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const checkDuplicateStmt = db_1.db.prepare(`
    SELECT id FROM ticket_records 
    WHERE batch_id = ? AND source = ? AND ticket_number = ? AND attendee_name = ?
  `);
    const transaction = db_1.db.transaction(() => {
        for (const ticket of tickets) {
            if (ticket.ticketNumber || ticket.attendeeName) {
                const existing = checkDuplicateStmt.get(batchId, source, ticket.ticketNumber || null, ticket.attendeeName || null);
                if (existing) {
                    duplicatesFound++;
                    warnings.push(`重复记录: ${ticket.ticketNumber || ticket.attendeeName}`);
                    continue;
                }
            }
            const result = insertStmt.run(batchId, source, ticket.ticketType, ticket.ticketNumber || null, ticket.attendeeName || null, ticket.price, ticket.quantity, ticket.notes || null);
            if (result.changes > 0) {
                recordsImported++;
            }
            else {
                duplicatesFound++;
            }
        }
    });
    transaction();
    updateBatchStatusAfterImport(batchId);
    const conflicts = (0, conflictService_1.detectConflicts)(batchId);
    if (conflicts.length > 0) {
        db_1.db.prepare('UPDATE show_batches SET needs_review = 1, status = ? WHERE id = ?').run(types_1.BatchStatus.PENDING_REVIEW, batchId);
    }
    return {
        batchId,
        recordsImported,
        duplicatesFound,
        warnings,
        conflicts
    };
}
function updateBatchStatusAfterImport(batchId) {
    const records = db_1.db.prepare(`
    SELECT ticket_type, COUNT(*) as count 
    FROM ticket_records 
    WHERE batch_id = ?
    GROUP BY ticket_type
  `).all(batchId);
    const hasPaid = records.some(r => r.ticket_type === types_1.TicketType.PAID);
    const hasComp = records.some(r => r.ticket_type === types_1.TicketType.COMP);
    const hasMixed = hasPaid && hasComp;
    db_1.db.prepare(`
    UPDATE show_batches 
    SET has_mixed_tickets = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(hasMixed ? 1 : 0, batchId);
    if (hasMixed) {
        db_1.db.prepare('UPDATE show_batches SET status = ? WHERE id = ?').run(types_1.BatchStatus.NEEDS_AUDIO_ENGINEER_REVIEW, batchId);
    }
}
function createBatch(batchDate, showName) {
    const result = db_1.db.prepare(`
    INSERT INTO show_batches (batch_date, show_name, status)
    VALUES (?, ?, ?)
  `).run(batchDate, showName, types_1.BatchStatus.DRAFT);
    return Number(result.lastInsertRowid);
}
