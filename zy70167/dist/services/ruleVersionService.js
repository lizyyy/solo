"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuleVersion = createRuleVersion;
exports.getRuleVersionById = getRuleVersionById;
exports.getLatestRuleVersion = getLatestRuleVersion;
exports.listRuleVersions = listRuleVersions;
exports.updateRuleVersion = updateRuleVersion;
exports.submitForApproval = submitForApproval;
exports.approveRuleVersion = approveRuleVersion;
exports.rejectRuleVersion = rejectRuleVersion;
exports.publishRuleVersion = publishRuleVersion;
exports.archiveRuleVersion = archiveRuleVersion;
exports.getRuleVersionStatusInfo = getRuleVersionStatusInfo;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const init_1 = __importDefault(require("../database/init"));
const stateMachine_1 = require("../utils/stateMachine");
const operationLogService_1 = require("./operationLogService");
function mapRowToRuleVersion(row) {
    return {
        id: row.id,
        ruleId: row.rule_id,
        ruleName: row.rule_name,
        version: row.version,
        status: row.status,
        content: row.content,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        publishedAt: row.published_at,
    };
}
async function createRuleVersion(request) {
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT MAX(version) as max_version FROM rule_versions WHERE rule_id = ?`, [request.ruleId], (err, result) => {
                if (err)
                    return reject(err);
                const nextVersion = (result?.max_version || 0) + 1;
                const id = (0, uuid_1.v4)();
                init_1.default.run(`INSERT INTO rule_versions (
              id, rule_id, rule_name, version, status, content, description,
              created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    id,
                    request.ruleId,
                    request.ruleName,
                    nextVersion,
                    'DRAFT',
                    request.content,
                    request.description,
                    request.createdBy,
                    now,
                    now,
                ], async (insertErr) => {
                    if (insertErr)
                        return reject(insertErr);
                    await (0, operationLogService_1.logOperation)('CREATE', 'RuleVersion', id, `创建规则版本 v${nextVersion}`, request.createdBy, {
                        toStatus: 'DRAFT',
                        metadata: {
                            ruleId: request.ruleId,
                            ruleName: request.ruleName,
                            version: nextVersion,
                        },
                    });
                    init_1.default.get(`SELECT * FROM rule_versions WHERE id = ?`, [id], (queryErr, row) => {
                        if (queryErr)
                            return reject(queryErr);
                        if (!row)
                            return reject(new Error('创建失败，未找到记录'));
                        resolve(mapRowToRuleVersion(row));
                    });
                });
            });
        });
    });
}
async function getRuleVersionById(id) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM rule_versions WHERE id = ?`, [id], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToRuleVersion(row));
        });
    });
}
async function getLatestRuleVersion(ruleId) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1`, [ruleId], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToRuleVersion(row));
        });
    });
}
async function listRuleVersions(ruleId, options) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const params = [];
    if (ruleId) {
        conditions.push('rule_id = ?');
        params.push(ruleId);
    }
    if (options?.status) {
        conditions.push('status = ?');
        params.push(options.status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT COUNT(*) as total FROM rule_versions ${whereClause}`, params, (err, countResult) => {
                if (err)
                    return reject(err);
                const listParams = [...params, pageSize, offset];
                init_1.default.all(`SELECT * FROM rule_versions ${whereClause} ORDER BY version DESC LIMIT ? OFFSET ?`, listParams, (queryErr, rows) => {
                    if (queryErr)
                        return reject(queryErr);
                    const versions = rows.map((row) => mapRowToRuleVersion(row));
                    resolve({
                        versions,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
async function updateRuleVersion(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        throw new Error(`仅草稿或已拒绝状态可以编辑。当前状态: ${existing.status}`);
    }
    const now = (0, moment_1.default)().toISOString();
    const updates = [];
    const params = [];
    if (request.ruleName) {
        updates.push('rule_name = ?');
        params.push(request.ruleName);
    }
    if (request.content) {
        updates.push('content = ?');
        params.push(request.content);
    }
    if (request.description !== undefined) {
        updates.push('description = ?');
        params.push(request.description);
    }
    if (updates.length === 0) {
        return existing;
    }
    updates.push('updated_at = ?');
    params.push(now, id);
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET ${updates.join(', ')} WHERE id = ?`, params, async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('UPDATE', 'RuleVersion', id, `更新规则版本 v${existing.version}`, request.updatedBy, {
                fromStatus: existing.status,
                toStatus: existing.status,
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('更新失败'));
            resolve(updated);
        });
    });
}
async function submitForApproval(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    const transitionError = (0, stateMachine_1.validateRuleVersionTransition)(existing.status, 'PENDING_APPROVAL');
    if (transitionError) {
        throw new Error(transitionError.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`, ['PENDING_APPROVAL', now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('SUBMIT', 'RuleVersion', id, `提交审批 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'PENDING_APPROVAL',
                metadata: { comment: request.comment },
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function approveRuleVersion(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    const transitionError = (0, stateMachine_1.validateRuleVersionTransition)(existing.status, 'APPROVED');
    if (transitionError) {
        throw new Error(transitionError.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET status = ?, updated_at = ?, approved_by = ?, approved_at = ? WHERE id = ?`, ['APPROVED', now, request.operator, now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('APPROVE', 'RuleVersion', id, `审批通过 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'APPROVED',
                metadata: { comment: request.comment },
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function rejectRuleVersion(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    const transitionError = (0, stateMachine_1.validateRuleVersionTransition)(existing.status, 'REJECTED');
    if (transitionError) {
        throw new Error(transitionError.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`, ['REJECTED', now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('REJECT', 'RuleVersion', id, `审批拒绝 v${existing.version} - ${request.reason}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'REJECTED',
                metadata: { reason: request.reason },
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function publishRuleVersion(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    const transitionError = (0, stateMachine_1.validateRuleVersionTransition)(existing.status, 'PUBLISHED');
    if (transitionError) {
        throw new Error(transitionError.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET status = ?, updated_at = ?, published_at = ? WHERE id = ?`, ['PUBLISHED', now, now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('PUBLISH', 'RuleVersion', id, `发布规则 v${existing.version}${request.comment ? ` - ${request.comment}` : ''}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'PUBLISHED',
                metadata: { comment: request.comment },
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function archiveRuleVersion(id, request) {
    const existing = await getRuleVersionById(id);
    if (!existing) {
        throw new Error(`规则版本不存在: ${id}`);
    }
    const transitionError = (0, stateMachine_1.validateRuleVersionTransition)(existing.status, 'ARCHIVED');
    if (transitionError) {
        throw new Error(transitionError.message);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE rule_versions SET status = ?, updated_at = ? WHERE id = ?`, ['ARCHIVED', now, id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('ARCHIVE', 'RuleVersion', id, `归档规则 v${existing.version}${request.reason ? ` - ${request.reason}` : ''}`, request.operator, {
                fromStatus: existing.status,
                toStatus: 'ARCHIVED',
                metadata: { reason: request.reason },
            });
            const updated = await getRuleVersionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
function getRuleVersionStatusInfo(status) {
    return {
        status,
        description: (0, stateMachine_1.getStatusDescription)(status),
        allowedTransitions: (0, stateMachine_1.getValidTransitions)(status).map((s) => ({
            status: s,
            description: (0, stateMachine_1.getStatusDescription)(s),
        })),
    };
}
//# sourceMappingURL=ruleVersionService.js.map