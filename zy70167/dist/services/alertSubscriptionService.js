"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscription = createSubscription;
exports.getSubscriptionById = getSubscriptionById;
exports.getSubscriptionBySubscriber = getSubscriptionBySubscriber;
exports.listSubscriptionsByRuleVersion = listSubscriptionsByRuleVersion;
exports.updateSubscription = updateSubscription;
exports.cancelSubscription = cancelSubscription;
exports.reactivateSubscription = reactivateSubscription;
exports.recordNotificationSuccess = recordNotificationSuccess;
exports.recordNotificationError = recordNotificationError;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const init_1 = __importDefault(require("../database/init"));
const ruleVersionService_1 = require("./ruleVersionService");
const operationLogService_1 = require("./operationLogService");
function mapRowToSubscription(row) {
    return {
        id: row.id,
        ruleVersionId: row.rule_version_id,
        subscriberId: row.subscriber_id,
        subscriberName: row.subscriber_name,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        lastNotifiedAt: row.last_notified_at,
        errorMessage: row.error_message,
    };
}
async function createSubscription(request) {
    const ruleVersion = await (0, ruleVersionService_1.getRuleVersionById)(request.ruleVersionId);
    if (!ruleVersion) {
        throw new Error(`规则版本不存在: ${request.ruleVersionId}`);
    }
    if (ruleVersion.status !== 'PUBLISHED') {
        throw new Error(`仅已发布的规则可以创建告警订阅。当前规则状态: ${ruleVersion.status}`);
    }
    const existing = await getSubscriptionBySubscriber(request.ruleVersionId, request.subscriberId);
    if (existing) {
        if (existing.status === 'ACTIVE') {
            throw new Error(`订阅者 ${request.subscriberId} 已订阅该规则版本`);
        }
        return reactivateSubscription(existing.id, request.operator);
    }
    const now = (0, moment_1.default)().toISOString();
    const id = (0, uuid_1.v4)();
    return new Promise((resolve, reject) => {
        init_1.default.run(`INSERT INTO alert_subscriptions (
        id, rule_version_id, subscriber_id, subscriber_name, email, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            id,
            request.ruleVersionId,
            request.subscriberId,
            request.subscriberName,
            request.email,
            'ACTIVE',
            now,
        ], async (err) => {
            if (err) {
                if (err?.code === 'SQLITE_CONSTRAINT') {
                    return reject(new Error(`订阅者 ${request.subscriberId} 已订阅该规则版本`));
                }
                return reject(err);
            }
            await (0, operationLogService_1.logOperation)('SUBSCRIBE', 'AlertSubscription', id, `创建告警订阅 - 订阅者: ${request.subscriberName}`, request.operator, {
                toStatus: 'ACTIVE',
                metadata: {
                    ruleId: ruleVersion.ruleId,
                    ruleVersion: ruleVersion.version,
                    subscriberId: request.subscriberId,
                    email: request.email,
                },
            });
            init_1.default.get(`SELECT * FROM alert_subscriptions WHERE id = ?`, [id], (queryErr, row) => {
                if (queryErr)
                    return reject(queryErr);
                if (!row)
                    return reject(new Error('创建失败'));
                resolve(mapRowToSubscription(row));
            });
        });
    });
}
async function getSubscriptionById(id) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM alert_subscriptions WHERE id = ?`, [id], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToSubscription(row));
        });
    });
}
async function getSubscriptionBySubscriber(ruleVersionId, subscriberId) {
    return new Promise((resolve, reject) => {
        init_1.default.get(`SELECT * FROM alert_subscriptions WHERE rule_version_id = ? AND subscriber_id = ?`, [ruleVersionId, subscriberId], (err, row) => {
            if (err)
                return reject(err);
            if (!row)
                return resolve(null);
            resolve(mapRowToSubscription(row));
        });
    });
}
async function listSubscriptionsByRuleVersion(ruleVersionId, options) {
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
            init_1.default.get(`SELECT COUNT(*) as total FROM alert_subscriptions ${whereClause}`, params, (err, countResult) => {
                if (err)
                    return reject(err);
                const listParams = [...params, pageSize, offset];
                init_1.default.all(`SELECT * FROM alert_subscriptions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, listParams, (queryErr, rows) => {
                    if (queryErr)
                        return reject(queryErr);
                    const subscriptions = rows.map((row) => mapRowToSubscription(row));
                    resolve({
                        subscriptions,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
async function updateSubscription(id, request) {
    const existing = await getSubscriptionById(id);
    if (!existing) {
        throw new Error(`订阅不存在: ${id}`);
    }
    const updates = [];
    const params = [];
    if (request.email) {
        updates.push('email = ?');
        params.push(request.email);
    }
    if (request.subscriberName) {
        updates.push('subscriber_name = ?');
        params.push(request.subscriberName);
    }
    if (updates.length === 0) {
        return existing;
    }
    params.push(id);
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE alert_subscriptions SET ${updates.join(', ')} WHERE id = ?`, params, async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('UPDATE', 'AlertSubscription', id, `更新告警订阅信息`, request.operator);
            const updated = await getSubscriptionById(id);
            if (!updated)
                return reject(new Error('更新失败'));
            resolve(updated);
        });
    });
}
async function cancelSubscription(id, operator) {
    const existing = await getSubscriptionById(id);
    if (!existing) {
        throw new Error(`订阅不存在: ${id}`);
    }
    if (existing.status !== 'ACTIVE') {
        throw new Error(`订阅状态不是 ACTIVE，当前状态: ${existing.status}`);
    }
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE alert_subscriptions SET status = ? WHERE id = ?`, ['INACTIVE', id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('UNSUBSCRIBE', 'AlertSubscription', id, `取消告警订阅`, operator, {
                fromStatus: 'ACTIVE',
                toStatus: 'INACTIVE',
                metadata: { subscriberName: existing.subscriberName },
            });
            const updated = await getSubscriptionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function reactivateSubscription(id, operator) {
    const existing = await getSubscriptionById(id);
    if (!existing) {
        throw new Error(`订阅不存在: ${id}`);
    }
    if (existing.status === 'ACTIVE') {
        throw new Error('订阅已是激活状态');
    }
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE alert_subscriptions SET status = ? WHERE id = ?`, ['ACTIVE', id], async (err) => {
            if (err)
                return reject(err);
            await (0, operationLogService_1.logOperation)('SUBSCRIBE', 'AlertSubscription', id, `重新激活告警订阅`, operator, {
                fromStatus: existing.status,
                toStatus: 'ACTIVE',
                metadata: { subscriberName: existing.subscriberName },
            });
            const updated = await getSubscriptionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function recordNotificationSuccess(id) {
    const existing = await getSubscriptionById(id);
    if (!existing) {
        throw new Error(`订阅不存在: ${id}`);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE alert_subscriptions SET status = ?, last_notified_at = ?, error_message = ? WHERE id = ?`, ['ACTIVE', now, null, id], async (err) => {
            if (err)
                return reject(err);
            const updated = await getSubscriptionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
async function recordNotificationError(id, errorMessage) {
    const existing = await getSubscriptionById(id);
    if (!existing) {
        throw new Error(`订阅不存在: ${id}`);
    }
    const now = (0, moment_1.default)().toISOString();
    return new Promise((resolve, reject) => {
        init_1.default.run(`UPDATE alert_subscriptions SET status = ?, error_message = ?, last_notified_at = ? WHERE id = ?`, ['ERROR', errorMessage, now, id], async (err) => {
            if (err)
                return reject(err);
            const updated = await getSubscriptionById(id);
            if (!updated)
                return reject(new Error('操作失败'));
            resolve(updated);
        });
    });
}
//# sourceMappingURL=alertSubscriptionService.js.map