"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestImportVersion = getLatestImportVersion;
exports.importSoundEngineerRecords = importSoundEngineerRecords;
exports.importRehearsalGroupRecords = importRehearsalGroupRecords;
exports.createBatch = createBatch;
const db_1 = require("../db");
const types_1 = require("../types");
const conflictService_1 = require("./conflictService");
function getLatestImportVersion(batchId, source) {
    const row = db_1.db.prepare(`
    SELECT MAX(import_version) as v FROM ticket_records WHERE batch_id = ? AND source = ?
  `).get(batchId, source);
    return row?.v || 0;
}
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
    const previousVersion = getLatestImportVersion(batchId, source);
    const importVersion = previousVersion + 1;
    let recordsImported = 0;
    let duplicatesFound = 0;
    const warnings = [];
    const insertStmt = db_1.db.prepare(`
    INSERT INTO ticket_records 
    (batch_id, source, import_version, ticket_type, ticket_number, attendee_name, price, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const checkSameVersionDuplicate = db_1.db.prepare(`
    SELECT id FROM ticket_records 
    WHERE batch_id = ? AND source = ? AND import_version = ? AND ticket_number = ? AND attendee_name = ?
  `);
    const transaction = db_1.db.transaction(() => {
        for (const ticket of tickets) {
            if (ticket.ticketNumber || ticket.attendeeName) {
                const existing = checkSameVersionDuplicate.get(batchId, source, importVersion, ticket.ticketNumber || null, ticket.attendeeName || null);
                if (existing) {
                    duplicatesFound++;
                    warnings.push(`本次导入内重复记录: ${ticket.ticketNumber || ticket.attendeeName}`);
                    continue;
                }
            }
            insertStmt.run(batchId, source, importVersion, ticket.ticketType, ticket.ticketNumber || null, ticket.attendeeName || null, ticket.price, ticket.quantity, ticket.notes || null);
            recordsImported++;
        }
    });
    transaction();
    if (previousVersion > 0) {
        warnings.push(`检测到历史导入版本：本次为 v${importVersion}，历史版本 v${previousVersion} 已归档`);
    }
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
    SELECT ticket_type, SUM(quantity) as count 
    FROM ticket_records tr
    INNER JOIN (
      SELECT source, MAX(import_version) as max_v 
      FROM ticket_records WHERE batch_id = ? GROUP BY source
    ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
    WHERE tr.batch_id = ?
    GROUP BY ticket_type
  `).all(batchId, batchId);
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
