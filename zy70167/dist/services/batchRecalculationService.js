"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBatchRecalculation = createBatchRecalculation;
exports.findExistingBatch = findExistingBatch;
exports.getBatchById = getBatchById;
exports.listBatchesByRuleVersion = listBatchesByRuleVersion;
exports.startBatch = startBatch;
exports.completeBatchSuccess = completeBatchSuccess;
exports.completeBatchFailed = completeBatchFailed;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const init_1 = __importDefault(require("../database/init"));
const ruleVersionService_1 = require("./ruleVersionService");
const operationLogService_1 = require("./operationLogService");
const stateMachine_1 = require("../utils/stateMachine");
function mapRowToBatch(row) {
    return {
        id: row.id,
        ruleVersionId: row.rule_version_id,
        batchDate: row.batch_date,
        status: row.status,
        dataCount: row.data_count,
        passCount: row.pass_count,
        failCount: row.fail_count,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdBy: row.created_by,
    };
}
const BATCH_TRANSITIONS = {
    PENDING: ['RUNNING', 'FAILED'],
    RUNNING: ['SUCCESS', 'FAILED'],
    SUCCESS: [],
    FAILED: [],
};
function canTransitionBatch(from, to) {
    return BATCH_TRANSITIONS[from]?.includes(to) || false;
}
function validateBatchTransition(from, to) {
    if (from === to) {
        return {
            valid: false,
            message: `批次状态已经是 "${to}"，无需重复操作`,
        };
    }
    if (!canTransitionBatch(from, to)) {
        const validTransitions = BATCH_TRANSITIONS[from] || [];
        return {
            valid: false,
            message: `无法从 "${(0, stateMachine_1.getBatchStatusDescription)(from)}" 转换到 "${(0, stateMachine_1.getBatchStatusDescription)(to)}"。允许的转换: ${validTransitions.length > 0
                ? validTransitions.map((s) => (0, stateMachine_1.getBatchStatusDescription)(s)).join('、')
                : '无'}`,
        };
    }
    return { valid: true };
}
async function createBatchRecalculation(request) {
    const ruleVersion = await (0, ruleVersionService_1.getRuleVersionById)(request.ruleVersionId);
    if (!ruleVersion) {
        throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
    }
    if (ruleVersion.status !== 'PUBLISHED') {
        throw new Error(`仅已发布的规则可以发起批次重算。当前规则状态: ${ruleVersion.status}`);
    }
    const existing = await findExistingBatch(request.ruleVersionId, request.batchDate);
    if (existing) {
        if (existing.status === 'PENDING' || existing.status === 'RUNNING') {
            throw new Error(`批次 ${request.batchDate} 已存在且状态为 ${existing.status}，请等待完成或处理后再操作`);
        }
        if (existing.status === 'SUCCESS') {
            throw new Error(`批次 ${request.batchDate} 已成功重算，无需重复创建`);
        }
    }
    const now = (0, moment_1.default)().toISOString();
    const id = (0, uuid_1.v4)();
    return new Promise((resolve, reject) => {
        init_1.default.run(`INSERT INTO batch_recalculations (
        id, rule_version_id, batch_date, status, data_count, pass_count, fail_count,
        started_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            request.ruleVersionId,
            request.batchDate,
            'PENDING',
            0,
            0,
            0,
            now,
            request.createdBy,
        ], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('BATCH_START', 'BatchRecalculation', id, `创建批次重算任务 - 日期: ${request.batchDate}`, request.createdBy, {
                toStatus: 'PENDING',
                metadata: {
                    ruleId: ruleVersion.ruleId,
                    ruleVersion: ruleVersion.version,
                    batchDate: request.batchDate,
                },
            });
            init_1.default.get(`SELECT * FROM batch_recalculations WHERE id = ?`, [id], (queryErr, row) => {
                if (queryErr)
                    return reject(queryErr);
                if (!row)
                    return reject(new Error('创建失败'));
                resolve(mapRowToBatch(row));
            });
        });
    });
}
async function findExistingBatch(ruleVersionId, batchDate) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM batch_recalculations WHERE rule_version_id = ? AND batch_date = ? ORDER BY started_at DESC LIMIT 1`, [ruleVersionId, batchDate], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToBatch(row));
        });
    });
}
async function getBatchById(id) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM batch_recalculations WHERE id = ?`, [id], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToBatch(row));
        });
    });
}
async function listBatchesByRuleVersion(ruleVersionId, options) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = ['rule_version_id = ?'];
    const params = [ruleVersionId];
    if (options?.status) {
        conditions.push('status = ?');
        params.push(options.status);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT COUNT(*) as total FROM batch_recalculations ${whereClause}`, params, (err, countResult) => {
                if (err)
                    return reject(err);
                const listParams = [...params, pageSize, offset];
                init_1.default.all(`SELECT * FROM batch_recalculations ${whereClause} ORDER BY started_at DESC LIMIT ? OFFSET ?`, listParams, (queryErr, rows) => {
                    if (queryErr)
                        return reject(queryErr);
                    const batches = rows.map((row) => mapRowToBatch(row));
                    resolve({
                        batches,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
async function startBatch(id, operator) {
    const existing = await getBatchById(id);
    if (!existing) {
        throw new Error(`批次不存在: ${id}`);
    }
    const validation = validateBatchTransition(existing.status, 'RUNNING');
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE batch_recalculations SET status = ? WHERE id = ?`, ['RUNNING', id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('BATCH_START', 'BatchRecalculation', id, `批次重算开始执行 - 日期: ${existing.batchDate}`, operator, {
                fromStatus: existing.status,
                toStatus: 'RUNNING',
            });
            const updated = await getBatchById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function completeBatchSuccess(id, request) {
    const existing = await getBatchById(id);
    if (!existing) {
        throw new Error(`批次不存在: ${id}`);
    }
    const validation = validateBatchTransition(existing.status, 'SUCCESS');
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE batch_recalculations SET 
       status = ?, data_count = ?, pass_count = ?, fail_count = ?, completed_at = ? 
       WHERE id = ?`, [
            'SUCCESS',
            request.dataCount ?? existing.dataCount,
            request.passCount ?? existing.passCount,
            request.failCount ?? existing.failCount,
            now,
            id,
        ], async (err) => {
            if (err)
                return reject(err);
            const dataCount = request.dataCount ?? existing.dataCount;
            const passCount = request.passCount ?? existing.passCount;
            const failCount = request.failCount ?? existing.failCount;
            const passRate = dataCount > 0 ? ((passCount / dataCount) * 100).toFixed(2) : '0';
            await (0, operationLogService_1.logOperation)('BATCH_SUCCESS', 'BatchRecalculation', id, `批次重算完成 - 日期: ${existing.batchDate}, 通过率: ${passRate}% (${passCount}/${dataCount})`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'SUCCESS',
                metadata: {
                    dataCount,
                    passCount,
                    failCount,
                    passRate: Number(passRate),
                },
            });
            const updated = await getBatchById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function completeBatchFailed(id, request) {
    const existing = await getBatchById(id);
    if (!existing) {
        throw new Error(`批次不存在: ${id}`);
    }
    const validation = validateBatchTransition(existing.status, 'FAILED');
    if (!validation.valid) {
        throw new Error(validation.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE batch_recalculations SET 
       status = ?, error_message = ?, completed_at = ? 
       WHERE id = ?`, ['FAILED', request.errorMessage, now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('BATCH_FAILED', 'BatchRecalculation', id, `批次重算失败 - 日期: ${existing.batchDate}, 原因: ${request.errorMessage || '未知错误'}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'FAILED',
                metadata: { errorMessage: request.errorMessage },
            });
            const updated = await getBatchById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
//# sourceMappingURL=batchRecalculationService.js.map