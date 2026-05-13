"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPointLogById = getPointLogById;
exports.getPointLogsByMemberId = getPointLogsByMemberId;
exports.getPointLogsByTransactionId = getPointLogsByTransactionId;
exports.createPointLog = createPointLog;
exports.getEarnedPointsByMemberId = getEarnedPointsByMemberId;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const memberService_1 = require("./memberService");
function dbRowToPointLog(row) {
    return {
        id: row.id,
        memberId: row.member_id,
        amount: row.amount,
        type: row.type,
        transactionId: row.transaction_id,
        redemptionId: row.redemption_id,
        recalculationTaskId: row.recalculation_task_id,
        description: row.description,
        createdAt: row.created_at
    };
}
async function getPointLogById(id) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM point_logs WHERE id = ?', [id]);
    return row ? dbRowToPointLog(row) : undefined;
}
async function getPointLogsByMemberId(memberId) {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM point_logs WHERE member_id = ? ORDER BY created_at DESC', [memberId]);
    return rows.map(dbRowToPointLog);
}
async function getPointLogsByTransactionId(transactionId) {
    const rows = await (0, database_1.getDbAll)('SELECT * FROM point_logs WHERE transaction_id = ?', [transactionId]);
    return rows.map(dbRowToPointLog);
}
async function createPointLog(memberId, amount, type, description, options) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    await (0, database_1.runDb)(`INSERT INTO point_logs 
     (id, member_id, amount, type, transaction_id, redemption_id, recalculation_task_id, description, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id,
        memberId,
        amount,
        type,
        options?.transactionId || null,
        options?.redemptionId || null,
        options?.recalculationTaskId || null,
        description,
        now
    ]);
    if (type === 'earn' || type === 'compensation') {
        await (0, memberService_1.addMemberPoints)(memberId, amount);
    }
    else if (type === 'spend' || type === 'adjustment') {
        await (0, memberService_1.deductMemberPoints)(memberId, Math.abs(amount));
    }
    const pointLog = await getPointLogById(id);
    if (!pointLog) {
        throw new Error('Failed to create point log');
    }
    return pointLog;
}
async function getEarnedPointsByMemberId(memberId) {
    const row = await (0, database_1.getDbOne)('SELECT COALESCE(SUM(amount), 0) as total FROM point_logs WHERE member_id = ? AND type = ?', [memberId, 'earn']);
    return row?.total || 0;
}
