"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitelistService = exports.WhitelistService = exports.WhitelistValidationError = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const moment_1 = __importDefault(require("moment"));
const whitelist_model_1 = require("../models/whitelist.model");
class WhitelistValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WhitelistValidationError';
    }
}
exports.WhitelistValidationError = WhitelistValidationError;
class WhitelistService {
    constructor() {
        this.CACHE_TTL = 300;
        this.cache = new node_cache_1.default({ stdTTL: this.CACHE_TTL, checkperiod: 60 });
    }
    validateCreateRequest(request) {
        if (!request.tenantId?.trim()) {
            throw new WhitelistValidationError('租户ID不能为空');
        }
        if (!request.tenantName?.trim()) {
            throw new WhitelistValidationError('租户名称不能为空');
        }
        if (!request.apiGroupId?.trim()) {
            throw new WhitelistValidationError('接口组ID不能为空');
        }
        if (!request.apiGroupName?.trim()) {
            throw new WhitelistValidationError('接口组名称不能为空');
        }
        if (!request.rateLimitRule) {
            throw new WhitelistValidationError('限流规则不能为空');
        }
        this.validateRateLimitRule(request.rateLimitRule);
        if (!request.effectiveDate) {
            throw new WhitelistValidationError('生效日期不能为空');
        }
        if (!request.expiryDate) {
            throw new WhitelistValidationError('失效日期不能为空');
        }
        if (new Date(request.effectiveDate) >= new Date(request.expiryDate)) {
            throw new WhitelistValidationError('生效日期必须早于失效日期');
        }
        if (!request.applicant?.trim()) {
            throw new WhitelistValidationError('申请人不能为空');
        }
        if (!request.reason?.trim()) {
            throw new WhitelistValidationError('申请原因不能为空');
        }
    }
    validateRateLimitRule(rule) {
        if (!rule.maxRequests || rule.maxRequests <= 0) {
            throw new WhitelistValidationError('限流请求数必须大于0');
        }
        if (!rule.unit) {
            throw new WhitelistValidationError('限流时间单位不能为空');
        }
    }
    validateStatusTransition(currentStatus, targetStatus) {
        const validTransitions = {
            [whitelist_model_1.WhitelistStatus.PENDING_APPROVAL]: [
                whitelist_model_1.WhitelistStatus.ACTIVE,
                whitelist_model_1.WhitelistStatus.REJECTED,
                whitelist_model_1.WhitelistStatus.REVOKED
            ],
            [whitelist_model_1.WhitelistStatus.ACTIVE]: [
                whitelist_model_1.WhitelistStatus.EXPIRING_SOON,
                whitelist_model_1.WhitelistStatus.EXPIRED,
                whitelist_model_1.WhitelistStatus.REVOKED
            ],
            [whitelist_model_1.WhitelistStatus.EXPIRING_SOON]: [
                whitelist_model_1.WhitelistStatus.EXPIRED,
                whitelist_model_1.WhitelistStatus.REVOKED
            ],
            [whitelist_model_1.WhitelistStatus.EXPIRED]: [],
            [whitelist_model_1.WhitelistStatus.REVOKED]: [
                whitelist_model_1.WhitelistStatus.PENDING_APPROVAL
            ],
            [whitelist_model_1.WhitelistStatus.REJECTED]: [
                whitelist_model_1.WhitelistStatus.PENDING_APPROVAL
            ]
        };
        return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
    }
    calculateStatus(record) {
        const now = new Date();
        const effectiveDate = new Date(record.effectiveDate);
        const expiryDate = new Date(record.expiryDate);
        if (record.status === whitelist_model_1.WhitelistStatus.REVOKED ||
            record.status === whitelist_model_1.WhitelistStatus.REJECTED ||
            record.status === whitelist_model_1.WhitelistStatus.PENDING_APPROVAL) {
            return record.status;
        }
        if (now < effectiveDate) {
            return whitelist_model_1.WhitelistStatus.PENDING_APPROVAL;
        }
        if (now > expiryDate) {
            return whitelist_model_1.WhitelistStatus.EXPIRED;
        }
        const daysUntilExpiry = (0, moment_1.default)(expiryDate).diff((0, moment_1.default)(now), 'days');
        if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
            return whitelist_model_1.WhitelistStatus.EXPIRING_SOON;
        }
        return whitelist_model_1.WhitelistStatus.ACTIVE;
    }
    checkDuplicate(tenantId, apiGroupId, excludeId) {
        const existing = whitelist_model_1.whitelistModel
            .findByTenantAndApiGroup(tenantId, apiGroupId)
            .filter(r => r.id !== excludeId &&
            (r.status === whitelist_model_1.WhitelistStatus.PENDING_APPROVAL ||
                r.status === whitelist_model_1.WhitelistStatus.ACTIVE ||
                r.status === whitelist_model_1.WhitelistStatus.EXPIRING_SOON));
        return existing.length > 0;
    }
    create(request) {
        this.validateCreateRequest(request);
        if (this.checkDuplicate(request.tenantId, request.apiGroupId)) {
            throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
        }
        return whitelist_model_1.whitelistModel.create(request);
    }
    findById(id) {
        return whitelist_model_1.whitelistModel.findById(id);
    }
    findAll(filters) {
        return whitelist_model_1.whitelistModel.findAll(filters);
    }
    getHistories(recordId) {
        return whitelist_model_1.whitelistModel.getHistories(recordId);
    }
    approve(id, request) {
        const record = whitelist_model_1.whitelistModel.findById(id);
        if (!record) {
            throw new WhitelistValidationError('白名单记录不存在');
        }
        if (!this.validateStatusTransition(record.status, whitelist_model_1.WhitelistStatus.ACTIVE)) {
            throw new WhitelistValidationError(`当前状态${record.status}不允许执行审批操作`);
        }
        const result = whitelist_model_1.whitelistModel.approve(id, request.approver, request.remark);
        if (result) {
            this.updateCache(result);
        }
        return result;
    }
    reject(id, approver, remark) {
        const record = whitelist_model_1.whitelistModel.findById(id);
        if (!record) {
            throw new WhitelistValidationError('白名单记录不存在');
        }
        if (!this.validateStatusTransition(record.status, whitelist_model_1.WhitelistStatus.REJECTED)) {
            throw new WhitelistValidationError(`当前状态${record.status}不允许执行拒绝操作`);
        }
        return whitelist_model_1.whitelistModel.reject(id, approver, remark);
    }
    revoke(id, operator, remark) {
        const record = whitelist_model_1.whitelistModel.findById(id);
        if (!record) {
            throw new WhitelistValidationError('白名单记录不存在');
        }
        if (!this.validateStatusTransition(record.status, whitelist_model_1.WhitelistStatus.REVOKED)) {
            throw new WhitelistValidationError(`当前状态${record.status}不允许执行撤回操作`);
        }
        const result = whitelist_model_1.whitelistModel.revoke(id, operator, remark);
        if (result) {
            this.clearCache(result.tenantId, result.apiGroupId);
        }
        return result;
    }
    resubmit(id, operator) {
        const record = whitelist_model_1.whitelistModel.findById(id);
        if (!record) {
            throw new WhitelistValidationError('白名单记录不存在');
        }
        if (record.status !== whitelist_model_1.WhitelistStatus.REVOKED &&
            record.status !== whitelist_model_1.WhitelistStatus.REJECTED) {
            throw new WhitelistValidationError('只有已撤回或已拒绝的记录才能重新提交');
        }
        if (this.checkDuplicate(record.tenantId, record.apiGroupId, id)) {
            throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
        }
        return whitelist_model_1.whitelistModel.updateStatus(id, whitelist_model_1.WhitelistStatus.PENDING_APPROVAL, operator, '重新提交申请');
    }
    update(id, updates, operator) {
        const record = whitelist_model_1.whitelistModel.findById(id);
        if (!record) {
            throw new WhitelistValidationError('白名单记录不存在');
        }
        if (record.status !== whitelist_model_1.WhitelistStatus.PENDING_APPROVAL) {
            throw new WhitelistValidationError('只有待审批状态的记录才能修改');
        }
        if (updates.rateLimitRule) {
            this.validateRateLimitRule(updates.rateLimitRule);
        }
        if (updates.effectiveDate && updates.expiryDate) {
            if (new Date(updates.effectiveDate) >= new Date(updates.expiryDate)) {
                throw new WhitelistValidationError('生效日期必须早于失效日期');
            }
        }
        const result = whitelist_model_1.whitelistModel.update(id, updates, operator);
        return result;
    }
    checkWhitelist(tenantId, apiGroupId) {
        const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const records = whitelist_model_1.whitelistModel
            .findByTenantAndApiGroup(tenantId, apiGroupId)
            .filter(r => {
            const status = this.calculateStatus(r);
            return status === whitelist_model_1.WhitelistStatus.ACTIVE || status === whitelist_model_1.WhitelistStatus.EXPIRING_SOON;
        });
        const result = records.length > 0
            ? { allowed: true, rule: records[0].rateLimitRule }
            : { allowed: false };
        this.cache.set(cacheKey, result);
        return result;
    }
    forceExpireCache(tenantId, apiGroupId) {
        const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
        this.cache.del(cacheKey);
    }
    updateCache(record) {
        const cacheKey = `whitelist:${record.tenantId}:${record.apiGroupId}`;
        this.cache.set(cacheKey, {
            allowed: true,
            rule: record.rateLimitRule
        });
    }
    clearCache(tenantId, apiGroupId) {
        const cacheKey = `whitelist:${tenantId}:${apiGroupId}`;
        this.cache.del(cacheKey);
    }
    bulkImport(requests) {
        const success = [];
        const failed = [];
        requests.forEach((data, index) => {
            try {
                this.validateCreateRequest(data);
                if (this.checkDuplicate(data.tenantId, data.apiGroupId)) {
                    throw new WhitelistValidationError('该租户在该接口组下已有待审批或生效的白名单');
                }
                const record = whitelist_model_1.whitelistModel.create(data);
                success.push(record);
            }
            catch (error) {
                failed.push({
                    row: index + 1,
                    error: error instanceof Error ? error.message : '未知错误',
                    data
                });
            }
        });
        return { success, failed };
    }
    export() {
        return whitelist_model_1.whitelistModel.export().map(record => ({
            ...record,
            status: this.calculateStatus(record)
        }));
    }
    refreshStatuses() {
        const records = whitelist_model_1.whitelistModel.findAll();
        records.forEach(record => {
            const newStatus = this.calculateStatus(record);
            if (newStatus !== record.status) {
                whitelist_model_1.whitelistModel.updateStatus(record.id, newStatus, 'system', '系统自动更新状态');
                if (newStatus === whitelist_model_1.WhitelistStatus.EXPIRED) {
                    this.clearCache(record.tenantId, record.apiGroupId);
                }
            }
        });
    }
    clearAll() {
        whitelist_model_1.whitelistModel.clear();
        this.cache.flushAll();
    }
    getCacheStats() {
        return this.cache.getStats();
    }
}
exports.WhitelistService = WhitelistService;
exports.whitelistService = new WhitelistService();
