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
function getUnifiedBatchResult(batchId) {
    const batch = db_1.db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId);
    if (!batch) {
        throw new Error(`批次 ${batchId} 不存在`);
    }
    const soundEngineerTickets = db_1.db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
    ORDER BY id
  `).all(batchId, types_1.DataSource.SOUND_ENGINEER);
    const rehearsalGroupTickets = db_1.db.prepare(`
    SELECT * FROM ticket_records 
    WHERE batch_id = ? AND source = ?
    ORDER BY id
  `).all(batchId, types_1.DataSource.REHEARSAL_GROUP);
    const revenueSplit = (0, revenueService_1.getLatestRevenueSplit)(batchId);
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
function exportBatchData(batchId) {
    const unified = getUnifiedBatchResult(batchId);
    return {
        exportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        ...unified
    };
}
function getBatchList() {
    const batches = db_1.db.prepare(`
    SELECT * FROM show_batches 
    ORDER BY created_at DESC
  `).all();
    return batches.map(batch => {
        const ticketCounts = db_1.db.prepare(`
      SELECT source, ticket_type, SUM(quantity) as qty
      FROM ticket_records 
      WHERE batch_id = ?
      GROUP BY source, ticket_type
    `).all(batch.id);
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
