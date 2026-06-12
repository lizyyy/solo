"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRevenueSplit = calculateRevenueSplit;
exports.getLatestRevenueSplit = getLatestRevenueSplit;
exports.getRevenueSplitHistory = getRevenueSplitHistory;
const db_1 = require("../db");
const types_1 = require("../types");
const VENUE_SPLIT_RATIO = 0.3;
const ARTIST_SPLIT_RATIO = 0.7;
const BAR_REVENUE_RATIO = 0.25;
function getRecordsForCalculation(batchId, useSource) {
    const canonicalCount = db_1.db.prepare('SELECT COUNT(*) as cnt FROM canonical_tickets WHERE batch_id = ?').get(batchId);
    if (canonicalCount.cnt > 0) {
        const batch = db_1.db.prepare('SELECT authoritative_source FROM show_batches WHERE id = ?').get(batchId);
        const records = db_1.db.prepare('SELECT * FROM canonical_tickets WHERE batch_id = ?').all(batchId);
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
    const queryParams = [batchId, batchId];
    if (useSource) {
        recordsQuery += ' AND tr.source = ?';
        queryParams.push(useSource);
    }
    const records = db_1.db.prepare(recordsQuery).all(...queryParams);
    return { records, authoritativeSource: useSource || null };
}
function calculateRevenueSplit(batchId, useSource) {
    const batch = db_1.db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId);
    if (!batch) {
        throw new Error(`批次 ${batchId} 不存在`);
    }
    const { records, authoritativeSource } = getRecordsForCalculation(batchId, useSource);
    let totalPaidTickets = 0;
    let totalCompTickets = 0;
    let totalRevenue = 0;
    for (const record of records) {
        if (record.ticket_type === types_1.TicketType.PAID) {
            totalPaidTickets += record.quantity;
            totalRevenue += record.price * record.quantity;
        }
        else if (record.ticket_type === types_1.TicketType.COMP) {
            totalCompTickets += record.quantity;
        }
    }
    const totalTickets = totalPaidTickets + totalCompTickets;
    const barRevenue = totalRevenue * BAR_REVENUE_RATIO;
    const netRevenue = totalRevenue - barRevenue;
    const venueSplit = netRevenue * VENUE_SPLIT_RATIO;
    const artistSplit = netRevenue * ARTIST_SPLIT_RATIO;
    const existingResult = db_1.db.prepare(`
    SELECT MAX(version) as max_version FROM revenue_split_results WHERE batch_id = ?
  `).get(batchId);
    const newVersion = (existingResult?.max_version || 0) + 1;
    db_1.db.prepare(`
    INSERT INTO revenue_split_results 
    (batch_id, authoritative_source, total_tickets, total_paid_tickets, total_comp_tickets, 
     total_revenue, bar_revenue, venue_split, artist_split, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, authoritativeSource, totalTickets, totalPaidTickets, totalCompTickets, totalRevenue, barRevenue, venueSplit, artistSplit, newVersion);
    db_1.db.prepare(`
    UPDATE show_batches SET updated_at = datetime('now') WHERE id = ?
  `).run(batchId);
    return getLatestRevenueSplit(batchId);
}
function getLatestRevenueSplit(batchId) {
    const result = db_1.db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC, calculated_at DESC 
    LIMIT 1
  `).get(batchId);
    if (!result)
        return null;
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
    };
}
function getRevenueSplitHistory(batchId) {
    const results = db_1.db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC, calculated_at DESC
  `).all(batchId);
    return results.map((result) => ({
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
