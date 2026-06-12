"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectConflicts = detectConflicts;
exports.resolveConflict = resolveConflict;
exports.getConflicts = getConflicts;
exports.getCanonicalTickets = getCanonicalTickets;
const db_1 = require("../db");
const types_1 = require("../types");
function getLatestRecordsBySource(batchId, source) {
    return db_1.db.prepare(`
    SELECT tr.* FROM ticket_records tr
    INNER JOIN (
      SELECT MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? AND source = ?
    ) latest ON tr.import_version = latest.max_v
    WHERE tr.batch_id = ? AND tr.source = ?
  `).all(batchId, source, batchId, source);
}
function detectConflicts(batchId) {
    const conflicts = [];
    const soundRecords = getLatestRecordsBySource(batchId, types_1.DataSource.SOUND_ENGINEER);
    const rehearsalRecords = getLatestRecordsBySource(batchId, types_1.DataSource.REHEARSAL_GROUP);
    if (soundRecords.length === 0 || rehearsalRecords.length === 0) {
        saveConflicts(batchId, conflicts);
        return conflicts;
    }
    const soundTotalQty = soundRecords.reduce((sum, r) => sum + r.quantity, 0);
    const rehearsalTotalQty = rehearsalRecords.reduce((sum, r) => sum + r.quantity, 0);
    if (soundTotalQty !== rehearsalTotalQty) {
        conflicts.push(createConflict(batchId, types_1.ConflictType.TICKET_COUNT_MISMATCH, String(soundTotalQty), String(rehearsalTotalQty), `总票数不一致：调音师记录 ${soundTotalQty} 张，排练群接龙 ${rehearsalTotalQty} 张`));
    }
    const soundCompCount = soundRecords
        .filter(r => r.ticket_type === types_1.TicketType.COMP)
        .reduce((sum, r) => sum + r.quantity, 0);
    const rehearsalCompCount = rehearsalRecords
        .filter(r => r.ticket_type === types_1.TicketType.COMP)
        .reduce((sum, r) => sum + r.quantity, 0);
    if (soundCompCount !== rehearsalCompCount) {
        conflicts.push(createConflict(batchId, types_1.ConflictType.TICKET_TYPE_MISMATCH, String(soundCompCount), String(rehearsalCompCount), `赠票数量不一致：调音师记录 ${soundCompCount} 张赠票，排练群接龙 ${rehearsalCompCount} 张赠票`));
    }
    const soundRevenue = soundRecords
        .filter(r => r.ticket_type === types_1.TicketType.PAID)
        .reduce((sum, r) => sum + (r.price * r.quantity), 0);
    const rehearsalRevenue = rehearsalRecords
        .filter(r => r.ticket_type === types_1.TicketType.PAID)
        .reduce((sum, r) => sum + (r.price * r.quantity), 0);
    if (Math.abs(soundRevenue - rehearsalRevenue) > 0.01) {
        conflicts.push(createConflict(batchId, types_1.ConflictType.REVENUE_MISMATCH, soundRevenue.toFixed(2), rehearsalRevenue.toFixed(2), `售票金额不一致：调音师记录 ¥${soundRevenue.toFixed(2)}，排练群接龙 ¥${rehearsalRevenue.toFixed(2)}`));
    }
    const soundAttendees = new Set(soundRecords.map(r => r.attendee_name).filter(Boolean));
    const rehearsalAttendees = new Set(rehearsalRecords.map(r => r.attendee_name).filter(Boolean));
    const onlyInSound = [...soundAttendees].filter(a => !rehearsalAttendees.has(a));
    const onlyInRehearsal = [...rehearsalAttendees].filter(a => !soundAttendees.has(a));
    if (onlyInSound.length > 0 || onlyInRehearsal.length > 0) {
        conflicts.push(createConflict(batchId, types_1.ConflictType.ATTENDEE_MISMATCH, onlyInSound.length > 0 ? onlyInSound.join(', ') : '无差异', onlyInRehearsal.length > 0 ? onlyInRehearsal.join(', ') : '无差异', `人员名单不一致：调音师独有 [${onlyInSound.join(', ')}]，排练群独有 [${onlyInRehearsal.join(', ')}]`));
    }
    saveConflicts(batchId, conflicts);
    return conflicts;
}
function createConflict(batchId, conflictType, soundEngineerValue, rehearsalGroupValue, description) {
    return {
        id: 0,
        batchId,
        conflictType,
        soundEngineerValue,
        rehearsalGroupValue,
        description,
        resolved: false
    };
}
function saveConflicts(batchId, conflicts) {
    db_1.db.prepare('DELETE FROM conflict_evidence WHERE batch_id = ? AND resolved = 0').run(batchId);
    const insertStmt = db_1.db.prepare(`
    INSERT INTO conflict_evidence 
    (batch_id, conflict_type, sound_engineer_value, rehearsal_group_value, description)
    VALUES (?, ?, ?, ?, ?)
  `);
    for (const conflict of conflicts) {
        const result = insertStmt.run(batchId, conflict.conflictType, conflict.soundEngineerValue, conflict.rehearsalGroupValue, conflict.description);
        conflict.id = Number(result.lastInsertRowid);
    }
}
function buildCanonicalFromSource(batchId, source, confirmedBy, resolution) {
    const records = getLatestRecordsBySource(batchId, source);
    const insert = db_1.db.prepare(`
    INSERT INTO canonical_tickets
    (batch_id, conflict_id, source_of_truth, ticket_type, ticket_number, attendee_name,
     price, quantity, confirmed_by, resolution, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    for (const r of records) {
        insert.run(batchId, null, source, r.ticket_type, r.ticket_number, r.attendee_name, r.price, r.quantity, confirmedBy, resolution, r.notes);
    }
}
function resolveConflict(conflictId, resolution, resolvedBy, customValue) {
    const conflict = db_1.db.prepare('SELECT * FROM conflict_evidence WHERE id = ?').get(conflictId);
    if (!conflict) {
        throw new Error(`冲突记录 ${conflictId} 不存在`);
    }
    const batchId = conflict.batch_id;
    const writeConflictTx = db_1.db.transaction(() => {
        db_1.db.prepare(`
      UPDATE conflict_evidence 
      SET resolved = 1, resolved_by = ?, resolved_at = datetime('now'), resolution = ?, custom_value = ?
      WHERE id = ?
    `).run(resolvedBy, resolution, customValue || null, conflictId);
        db_1.db.prepare('DELETE FROM canonical_tickets WHERE batch_id = ?').run(batchId);
        let authoritativeSource = null;
        if (resolution === 'confirm_sound_engineer') {
            buildCanonicalFromSource(batchId, types_1.DataSource.SOUND_ENGINEER, resolvedBy, resolution);
            authoritativeSource = types_1.DataSource.SOUND_ENGINEER;
        }
        else if (resolution === 'confirm_rehearsal_group') {
            buildCanonicalFromSource(batchId, types_1.DataSource.REHEARSAL_GROUP, resolvedBy, resolution);
            authoritativeSource = types_1.DataSource.REHEARSAL_GROUP;
        }
        else if (resolution === 'custom' && customValue) {
            authoritativeSource = 'custom';
        }
        const unresolved = db_1.db.prepare(`
      SELECT COUNT(*) as count FROM conflict_evidence 
      WHERE batch_id = ? AND resolved = 0
    `).get(batchId);
        if (unresolved.count === 0) {
            const canonicalCount = db_1.db.prepare(`
        SELECT COUNT(*) as cnt FROM canonical_tickets WHERE batch_id = ?
      `).get(batchId);
            if (canonicalCount.cnt === 0 && authoritativeSource && authoritativeSource !== 'custom') {
                buildCanonicalFromSource(batchId, authoritativeSource, resolvedBy, resolution);
            }
            let finalStatus = 'draft';
            const canonicalTickets = db_1.db.prepare(`
        SELECT ticket_type, SUM(quantity) as qty FROM canonical_tickets WHERE batch_id = ? GROUP BY ticket_type
      `).all(batchId);
            const hasPaid = canonicalTickets.some(t => t.ticket_type === types_1.TicketType.PAID);
            const hasComp = canonicalTickets.some(t => t.ticket_type === types_1.TicketType.COMP);
            if (hasPaid && hasComp) {
                finalStatus = 'needs_audio_engineer_review';
            }
            db_1.db.prepare(`
        UPDATE show_batches 
        SET needs_review = 0, 
            status = ?,
            authoritative_source = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(finalStatus, authoritativeSource, batchId);
        }
        else {
            db_1.db.prepare(`
        UPDATE show_batches SET updated_at = datetime('now') WHERE id = ?
      `).run(batchId);
        }
    });
    writeConflictTx();
    return db_1.db.prepare('SELECT * FROM conflict_evidence WHERE id = ?').get(conflictId);
}
function getConflicts(batchId) {
    return db_1.db.prepare(`
    SELECT * FROM conflict_evidence WHERE batch_id = ? ORDER BY id DESC
  `).all(batchId);
}
function getCanonicalTickets(batchId) {
    const rows = db_1.db.prepare(`
    SELECT * FROM canonical_tickets WHERE batch_id = ? ORDER BY id
  `).all(batchId);
    return rows.map(r => ({
        id: r.id,
        batchId: r.batch_id,
        conflictId: r.conflict_id ?? undefined,
        sourceOfTruth: r.source_of_truth,
        ticketType: r.ticket_type,
        ticketNumber: r.ticket_number ?? undefined,
        attendeeName: r.attendee_name ?? undefined,
        price: r.price,
        quantity: r.quantity,
        confirmedBy: r.confirmed_by,
        confirmedAt: r.confirmed_at,
        resolution: r.resolution,
        notes: r.notes ?? undefined
    }));
}
