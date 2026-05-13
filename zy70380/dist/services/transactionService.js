"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionById = getTransactionById;
exports.getTransactionsByMemberId = getTransactionsByMemberId;
exports.createTransaction = createTransaction;
const uuid_1 = require("uuid");
const database_1 = require("../database");
function dbRowToTransaction(row) {
    return {
        id: row.id,
        memberId: row.member_id,
        amount: row.amount,
        category: row.category,
        createdAt: row.created_at
    };
}
async function getTransactionById(id) {
    const row = await (0, database_1.getDbOne)('SELECT * FROM transactions WHERE id = ?', [id]);
    return row ? dbRowToTransaction(row) : undefined;
}
async function getTransactionsByMemberId(memberId, startTime, endTime) {
    let sql = 'SELECT * FROM transactions WHERE member_id = ?';
    const params = [memberId];
    if (startTime) {
        sql += ' AND created_at >= ?';
        params.push(startTime);
    }
    if (endTime) {
        sql += ' AND created_at <= ?';
        params.push(endTime);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await (0, database_1.getDbAll)(sql, params);
    return rows.map(dbRowToTransaction);
}
async function createTransaction(memberId, amount, category, createdAt) {
    const now = createdAt || new Date().toISOString();
    const id = (0, uuid_1.v4)();
    await (0, database_1.runDb)('INSERT INTO transactions (id, member_id, amount, category, created_at) VALUES (?, ?, ?, ?, ?)', [id, memberId, amount, category, now]);
    const transaction = await getTransactionById(id);
    if (!transaction) {
        throw new Error('Failed to create transaction');
    }
    return transaction;
}
