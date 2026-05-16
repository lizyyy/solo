"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("./types");
const storage_1 = require("./storage");
class QuotaService {
    constructor() {
        this.validUsageTags = ['research', 'production', 'testing', 'internal', 'customer-demo', 'fine-tuning'];
        this.storage = storage_1.Storage.getInstance();
    }
    getWindowDates(window) {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        switch (window) {
            case types_1.QuotaWindow.DAILY:
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case types_1.QuotaWindow.WEEKLY:
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end.setDate(diff + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case types_1.QuotaWindow.MONTHLY:
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
        }
        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }
    checkWindowReset(config) {
        const now = new Date();
        const windowEnd = new Date(config.windowEnd);
        if (now > windowEnd) {
            const { start, end } = this.getWindowDates(config.window);
            return {
                ...config,
                used: 0,
                windowStart: start,
                windowEnd: end,
                updatedAt: now.toISOString()
            };
        }
        return config;
    }
    createQuota(teamName, modelName, usageTag, limit, window, createdBy) {
        const existing = this.storage.findQuotaConfig(teamName, modelName, usageTag);
        if (existing) {
            throw new Error(`Quota already exists for team: ${teamName}, model: ${modelName}, usage: ${usageTag}`);
        }
        const { start, end } = this.getWindowDates(window);
        const now = new Date().toISOString();
        const config = {
            id: (0, uuid_1.v4)(),
            teamName,
            modelName,
            usageTag,
            limit,
            used: 0,
            window,
            status: types_1.QuotaStatus.ACTIVE,
            tempBonus: 0,
            windowStart: start,
            windowEnd: end,
            createdAt: now,
            updatedAt: now,
            createdBy
        };
        this.storage.addQuotaConfig(config);
        this.addAuditLog(config.id, 'CREATE', createdBy, null, config, 'Initial quota creation');
        return config;
    }
    getQuota(id) {
        const config = this.storage.getQuotaConfig(id);
        if (config) {
            return this.checkWindowReset(config);
        }
        return undefined;
    }
    getAllQuotas() {
        return this.storage.getQuotaConfigs().map(c => this.checkWindowReset(c));
    }
    validateUsage(teamName, modelName, usageTag, tokens, requestId) {
        let config = this.storage.findQuotaConfig(teamName, modelName, usageTag);
        const timestamp = new Date().toISOString();
        if (!config) {
            const rejectEvent = this.createRejectEvent('', teamName, modelName, usageTag, types_1.RejectReason.MODEL_NOT_AUTHORIZED, { teamName, modelName, usageTag, tokens, requestId, timestamp }, {
                currentLimit: 0,
                currentUsed: 0,
                windowStart: '',
                windowEnd: '',
                quotaStatus: types_1.QuotaStatus.EXPIRED
            }, 'No quota configuration found for this team/model/usage combination');
            return { success: false, rejectEvent };
        }
        config = this.checkWindowReset(config);
        if (config.status !== types_1.QuotaStatus.ACTIVE) {
            const rejectEvent = this.createRejectEvent(config.id, teamName, modelName, usageTag, types_1.RejectReason.SUSPENDED, { teamName, modelName, usageTag, tokens, requestId, timestamp }, {
                currentLimit: config.limit,
                currentUsed: config.used,
                windowStart: config.windowStart,
                windowEnd: config.windowEnd,
                quotaStatus: config.status
            }, `Quota is currently ${config.status}`);
            return { success: false, rejectEvent, config };
        }
        if (!this.validUsageTags.includes(usageTag)) {
            const rejectEvent = this.createRejectEvent(config.id, teamName, modelName, usageTag, types_1.RejectReason.INVALID_USAGE_TAG, { teamName, modelName, usageTag, tokens, requestId, timestamp }, {
                currentLimit: config.limit,
                currentUsed: config.used,
                windowStart: config.windowStart,
                windowEnd: config.windowEnd,
                quotaStatus: config.status
            }, `Invalid usage tag: ${usageTag}. Valid tags: ${this.validUsageTags.join(', ')}`);
            return { success: false, rejectEvent, config };
        }
        const effectiveLimit = config.limit + config.tempBonus;
        if (config.used + tokens > effectiveLimit) {
            const rejectEvent = this.createRejectEvent(config.id, teamName, modelName, usageTag, types_1.RejectReason.QUOTA_EXHAUSTED, { teamName, modelName, usageTag, tokens, requestId, timestamp }, {
                currentLimit: config.limit,
                currentUsed: config.used,
                windowStart: config.windowStart,
                windowEnd: config.windowEnd,
                quotaStatus: config.status
            }, `Quota exhausted. Used: ${config.used}, Requested: ${tokens}, Limit: ${config.limit}, Bonus: ${config.tempBonus}`);
            return { success: false, rejectEvent, config };
        }
        config = this.storage.updateQuotaConfig(config.id, {
            used: config.used + tokens
        });
        const usageRecord = {
            id: (0, uuid_1.v4)(),
            quotaId: config.id,
            teamName,
            modelName,
            usageTag,
            tokens,
            timestamp,
            requestId,
            success: true
        };
        this.storage.addUsageRecord(usageRecord);
        return { success: true, config };
    }
    createRejectEvent(quotaId, teamName, modelName, usageTag, reason, rawInput, processingBasis, conclusion) {
        const event = {
            id: (0, uuid_1.v4)(),
            quotaId,
            teamName,
            modelName,
            usageTag,
            reason,
            rawInput,
            processingBasis,
            conclusion,
            timestamp: rawInput.timestamp,
            requestId: rawInput.requestId
        };
        this.storage.addRejectEvent(event);
        return event;
    }
    addTempBonus(quotaId, bonusAmount, operator, reason) {
        const config = this.storage.getQuotaConfig(quotaId);
        if (!config) {
            throw new Error(`Quota not found: ${quotaId}');
    }

    const before = { ...config };
    const updated = this.storage.updateQuotaConfig(quotaId, {
      tempBonus: config.tempBonus + bonusAmount
    })!;

    this.addAuditLog(quotaId, 'TEMP_BONUS', operator, before, updated, reason);
    return updated;
  }

  public updateQuotaStatus(quotaId: string, status: QuotaStatus, operator: string, reason: string): QuotaConfig {
    const config = this.storage.getQuotaConfig(quotaId);
    if (!config) {
      throw new Error(`, Quota, not, found, $, { quotaId }, '););
        }
        const before = { ...config };
        const updated = this.storage.updateQuotaConfig(quotaId, { status });
        this.addAuditLog(quotaId, 'STATUS_CHANGE', operator, before, updated, reason);
        return updated;
    }
    manualAdjust(quotaId, adjustments, operator, reason) {
        const config = this.storage.getQuotaConfig(quotaId);
        if (!config) {
            throw new Error(`Quota not found: ${quotaId}');
    }

    const before = { ...config };
    const updated = this.storage.updateQuotaConfig(quotaId, adjustments)!;

    this.addAuditLog(quotaId, 'MANUAL_ADJUST', operator, before, updated, reason);
    return updated;
  }

  private addAuditLog(quotaId: string, action: string, operator: string, before: any, after: any, reason: string): void {
    const log: AuditLog = {
      id: uuidv4(),
      quotaId,
      action,
      operator,
      before,
      after,
      reason,
      timestamp: new Date().toISOString()
    };
    this.storage.addAuditLog(log);
  }

  public getSummary(quotaId: string): UsageSummary {
    const config = this.getQuota(quotaId);
    if (!config) {
      throw new Error(`, Quota, not, found, $, { quotaId } `);
    }

    const rejectEvents = this.storage.getRejectEvents(quotaId);
    const effectiveLimit = config.limit + config.tempBonus;

    return {
      teamName: config.teamName,
      modelName: config.modelName,
      usageTag: config.usageTag,
      window: config.window,
      totalLimit: config.limit,
      totalUsed: config.used,
      tempBonus: config.tempBonus,
      remaining: effectiveLimit - config.used,
      utilizationRate: (config.used / effectiveLimit) * 100,
      rejectCount: rejectEvents.length,
      windowStart: config.windowStart,
      windowEnd: config.windowEnd,
      lastUpdated: config.updatedAt
    };
  }

  public getRejectEvents(quotaId?: string): RejectEvent[] {
    return this.storage.getRejectEvents(quotaId);
  }

  public getAuditLogs(quotaId?: string): AuditLog[] {
    return this.storage.getAuditLogs(quotaId);
  }

  public exportQuota(quotaId: string, exportBy: string): ExportRecord {
    const config = this.getQuota(quotaId);
    if (!config) {
      throw new Error(`, Quota, not, found, $, { quotaId } `);
    }

    return {
      quotaConfig: config,
      usageRecords: this.storage.getUsageRecords(quotaId),
      rejectEvents: this.storage.getRejectEvents(quotaId),
      summary: this.getSummary(quotaId),
      exportTime: new Date().toISOString(),
      exportBy
    };
  }

  public exportAll(exportBy: string): ExportRecord[] {
    const configs = this.getAllQuotas();
    return configs.map(config => this.exportQuota(config.id, exportBy));
  }

  public getValidUsageTags(): string[] {
    return [...this.validUsageTags];
  }
}
            );
        }
    }
}
exports.QuotaService = QuotaService;
