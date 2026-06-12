"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnifiedBatchResult = getUnifiedBatchResult;
exports.exportBatchData = exportBatchData;
exports.getBatchList = getBatchList;
const db_1 = require("../db");
const revenueService_1 = require("./revenueService");
const conflictService_1 = require("./conflictService");
const selfCheckService_1 = require("./selfCheckService");
const types_1 = require("../types");
function getLatestBySource(batchId, source) {
    return db_1.db.prepare(`
    SELECT tr.* FROM ticket_records tr
    INNER JOIN (
      SELECT MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? AND source = ?
    ) latest ON tr.import_version = latest.max_v
    WHERE tr.batch_id = ? AND tr.source = ?
    ORDER BY tr.id
  `).all(batchId, source, batchId, source);
}
function getUnifiedBatchResult(batchId) {
    const batch = db_1.db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId);
    if (!batch) {
        throw new Error(`批次 ${batchId} 不存在`);
    }
    const soundEngineerTickets = getLatestBySource(batchId, types_1.DataSource.SOUND_ENGINEER);
    const rehearsalGroupTickets = getLatestBySource(batchId, types_1.DataSource.REHEARSAL_GROUP);
    const canonicalTickets = (0, conflictService_1.getCanonicalTickets)(batchId);
    const revenueSplit = (0, revenueService_1.getLatestRevenueSplit)(batchId);
    const revenueSplitHistory = (0, revenueService_1.getRevenueSplitHistory)(batchId);
    const conflicts = (0, conflictService_1.getConflicts)(batchId);
    const selfCheckResults = (0, selfCheckService_1.runAllChecks)(batchId);
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
function exportBatchData(batchId) {
    const unified = getUnifiedBatchResult(batchId);
    return {
        exportVersion: '2.0',
        exportedAt: new Date().toISOString(),
        exportSource: 'canonical_tickets',
        authoritativeSource: unified.batch.authoritativeSource,
        ...unified
    };
}
function getBatchList() {
    const batches = db_1.db.prepare(`
    SELECT * FROM show_batches 
    ORDER BY created_at DESC
  `).all();
    return batches.map(batch => {
        const canonicalCount = db_1.db.prepare('SELECT COUNT(*) as cnt FROM canonical_tickets WHERE batch_id = ?').get(batch.id);
        let totalTickets = 0;
        let paidCount = 0;
        let compCount = 0;
        if (canonicalCount.cnt > 0) {
            const summary = db_1.db.prepare(`
        SELECT ticket_type, SUM(quantity) as qty FROM canonical_tickets WHERE batch_id = ? GROUP BY ticket_type
      `).all(batch.id);
            for (const s of summary) {
                if (s.ticket_type === types_1.TicketType.PAID)
                    paidCount = s.qty;
                else if (s.ticket_type === types_1.TicketType.COMP)
                    compCount = s.qty;
            }
            totalTickets = paidCount + compCount;
        }
        else {
            const rawSummary = db_1.db.prepare(`
        SELECT tr.ticket_type, SUM(tr.quantity) as qty
        FROM ticket_records tr
        INNER JOIN (
          SELECT source, MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? GROUP BY source
        ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
        WHERE tr.batch_id = ?
        GROUP BY tr.ticket_type
      `).all(batch.id, batch.id);
            for (const s of rawSummary) {
                if (s.ticket_type === types_1.TicketType.PAID)
                    paidCount = s.qty;
                else if (s.ticket_type === types_1.TicketType.COMP)
                    compCount = s.qty;
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
