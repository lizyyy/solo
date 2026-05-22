"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordHistory = recordHistory;
exports.getHistoryBySource = getHistoryBySource;
exports.getAllHistory = getAllHistory;
exports.getHistoryByUser = getHistoryByUser;
exports.printHistoryDiff = printHistoryDiff;
const database_1 = require("../database");
const uuid_1 = require("uuid");
const diff = __importStar(require("diff"));
async function recordHistory(sourceType, sourceId, action, beforeData, afterData, performedBy, remark) {
    const db = await (0, database_1.getDatabase)();
    const beforeStr = beforeData ? JSON.stringify(beforeData, null, 2) : '';
    const afterStr = afterData ? JSON.stringify(afterData, null, 2) : '';
    const diffResult = diff.diffJson(beforeData || {}, afterData || {});
    const diffStr = diffResult.map(part => {
        if (part.added)
            return `+ ${part.value}`;
        if (part.removed)
            return `- ${part.value}`;
        return `  ${part.value}`;
    }).join('');
    await db.run(`
    INSERT INTO history_records 
    (id, sourceType, sourceId, action, beforeData, afterData, diff, performedBy, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        (0, uuid_1.v4)(),
        sourceType,
        sourceId,
        action,
        beforeStr,
        afterStr,
        diffStr,
        performedBy,
        remark
    ]);
}
async function getHistoryBySource(sourceType, sourceId) {
    const db = await (0, database_1.getDatabase)();
    return db.all(`
    SELECT * FROM history_records 
    WHERE sourceType = ? AND sourceId = ?
    ORDER BY performedAt DESC
  `, [sourceType, sourceId]);
}
async function getAllHistory(limit = 100) {
    const db = await (0, database_1.getDatabase)();
    return db.all(`
    SELECT * FROM history_records 
    ORDER BY performedAt DESC
    LIMIT ?
  `, [limit]);
}
async function getHistoryByUser(performedBy, limit = 50) {
    const db = await (0, database_1.getDatabase)();
    return db.all(`
    SELECT * FROM history_records 
    WHERE performedBy = ?
    ORDER BY performedAt DESC
    LIMIT ?
  `, [performedBy, limit]);
}
function printHistoryDiff(history) {
    console.log(`\n=== 历史记录: ${history.action} ===`);
    console.log(`时间: ${history.performedAt}`);
    console.log(`操作人: ${history.performedBy}`);
    if (history.remark) {
        console.log(`备注: ${history.remark}`);
    }
    console.log('\n--- 变更差异 ---');
    console.log(history.diff);
    console.log('================\n');
}
