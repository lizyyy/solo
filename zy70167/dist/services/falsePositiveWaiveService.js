"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFalsePositiveWaive = createFalsePositiveWaive;
exports.getWaiveById = getWaiveById;
exports.listWaivesByRuleVersion = listWaivesByRuleVersion;
exports.listWaivesByBatch = listWaivesByBatch;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const init_1 = __importDefault(require("../database/init"));
const ruleVersionService_1 = require("./ruleVersionService");
const batchRecalculationService_1 = require("./batchRecalculationService");
const operationLogService_1 = require("./operationLogService");
function mapRowToWaive(row) {
    return {
        id: row.id,
        ruleVersionId: row.rule_version_id,
        batchId: row.batch_id,
        reason: row.reason,
        waivedBy: row.waived_by,
        waivedAt: row.waived_at,
        affectedRows: row.affected_rows,
    };
}
async function createFalsePositiveWaive(request) {
    const ruleVersion = await (0, ruleVersionService_1.getRuleVersionById)(request.ruleVersionId);
    if (!ruleVersion) {
        throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
    }
    const batch = await (0, batchRecalculationService_1.getBatchById)(request.batchId);
    if (!batch) {
        throw new Error(`批次不存在: ${request.batchId}`);
    }
    if (batch.ruleVersionId !== request.ruleVersionId) {
        throw new Error(`批次不属于该规则版本`);
    }
    if (batch.status !== 'SUCCESS') {
        throw new Error(`仅成功完成的批次可以申请误报豁免。当前批次状态: ${batch.status}`);
    }
    if (!request.reason || request.reason.trim().length === 0) {
        throw new Error('误报豁免原因不能为空');
    }
    const now = (0, moment_1.default)().toISOString();
    const id = (0, uuid_1.v4)();
    const affectedRows = request.affectedRows || 0;
    return new Promise((resolve, reject) => {
        init_1.default.run(`INSERT INTO false_positive_waives (
        id, rule_version_id, batch_id, reason, waived_by, waived_at, affected_rows
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            id,
            request.ruleVersionId,
            request.batchId,
            request.reason,
            request.waivedBy,
            now,
            affectedRows,
        ], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('WAIVE', 'FalsePositiveWaive', id, `误报豁免 - 批次日期: ${batch.batchDate}, 影响行数: ${affectedRows}, 原因: ${request.reason}`, request.waivedBy, {
                metadata: {
                    ruleId: ruleVersion.ruleId,
                    ruleVersion: ruleVersion.version,
                    batchDate: batch.batchDate,
                    affectedRows,
                    reason: request.reason,
                },
            });
            init_1.default.get(`SELECT * FROM false_positive_waives WHERE id = ?`, [id], (queryErr, row) => {
                if (queryErr)
                    return reject(queryErr);
                if (!row)
                    return reject(new Error('创建失败'));
                resolve(mapRowToWaive(row));
            });
        });
    });
}
async function getWaiveById(id) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM false_positive_waives WHERE id = ?`, [id], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToWaive(row));
        });
    });
}
async function listWaivesByRuleVersion(ruleVersionId, options) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT COUNT(*) as total FROM false_positive_waives WHERE rule_version_id = ?`, [ruleVersionId], (err, countResult) => {
                if (err)
                    return reject(err);
                init_1.default.all(`SELECT * FROM false_positive_waives WHERE rule_version_id = ? ORDER BY waived_at DESC LIMIT ? OFFSET ?`, [ruleVersionId, pageSize, offset], (queryErr, rows) => {
                    if (queryErr)
                        return reject(queryErr);
                    const waives = rows.map((row) => mapRowToWaive(row));
                    resolve({
                        waives,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
async function listWaivesByBatch(batchId) {
    return new Promise((resolve, reject) => {
        init_1.default.all(`SELECT * FROM false_positive_waives WHERE batch_id = ? ORDER BY waived_at DESC`, [batchId], (err, rows) => {
            if (err)
                return reject(err);
            const waives = rows.map((row) => mapRowToWaive(row));
            resolve(waives);
        });
    });
}
//# sourceMappingURL=falsePositiveWaiveService.js.map