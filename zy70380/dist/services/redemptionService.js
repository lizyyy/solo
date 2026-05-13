"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedemptionById = getRedemptionById;
exports.getRedemptionsByMemberId = getRedemptionsByMemberId;
exports.getConfirmedRedemptionsByMemberId = getConfirmedRedemptionsByMemberId;
exports.getTotalLockedPoints = getTotalLockedPoints;
exports.createRedemption = createRedemption;
exports.confirmRedemption = confirmRedemption;
exports.cancelRedemption = cancelRedemption;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const pointLogService_1 = require("./pointLogService");
function dbRowToRedemption(row) {
    return {
        id: row.id,
        memberId: row.member_id,
        points: row.points,
        giftName: row.gift_name,
        giftId: row.gift_id,
        status: row.status,
        createdAt: row.created_at
    };
}
async function getRedemptionById(id) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM redemptions WHERE id = ?', [id]);
    return row ? dbRowToRedemption(row) : undefined;
}
async function getRedemptionsByMemberId(memberId) {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM redemptions WHERE member_id = ? ORDER BY created_at DESC', [memberId]);
    return rows.map(dbRowToRedemption);
}
async function getConfirmedRedemptionsByMemberId(memberId) {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM redemptions WHERE member_id = ? AND status = ? ORDER BY created_at DESC', [memberId, 'confirmed']);
    return rows.map(dbRowToRedemption);
}
async function getTotalLockedPoints(memberId) {
    const row = await (0, database_1.getDbOne)('SELECT COALESCE(SUM(points), 0) as total FROM redemptions WHERE member_id = ? AND status = ?', [memberId, 'confirmed']);
    return row?.total || 0;
}
async function createRedemption(memberId, points, giftName, giftId) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    await (0, database_1.runDb)(`INSERT INTO redemptions (id, member_id, points, gift_name, gift_id, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, memberId, points, giftName, giftId, 'pending', now]);
    const redemption = await getRedemptionById(id);
    if (!redemption) {
        throw new Error('Failed to create redemption');
    }
    return redemption;
}
async function confirmRedemption(id) {
    const redemption = await getRedemptionById(id);
    if (!redemption) {
        throw new Error('Redemption not found');
    }
    const now = new Date().toISOString();
    await (0, database_1.runDb)('UPDATE redemptions SET status = ? WHERE id = ?', ['confirmed', id]);
    await (0, pointLogService_1.createPointLog)(redemption.memberId, redemption.points, 'spend', `兑换礼品: ${redemption.giftName}`, { redemptionId: id });
}
async function cancelRedemption(id) {
    const now = new Date().toISOString();
    await (0, database_1.runDb)('UPDATE redemptions SET status = ? WHERE id = ?', ['cancelled', id]);
}
