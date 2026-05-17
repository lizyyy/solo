import NodeCache from 'node-cache';
import { WhitelistRecord, WhitelistStatus, CreateWhitelistRequest, UpdateWhitelistRequest, ApproveWhitelistRequest, RateLimitRule } from '../models/whitelist.model';
export declare class WhitelistValidationError extends Error {
    constructor(message: string);
}
export declare class WhitelistService {
    private cache;
    private readonly CACHE_TTL;
    constructor();
    validateCreateRequest(request: CreateWhitelistRequest): void;
    validateRateLimitRule(rule: RateLimitRule): void;
    validateStatusTransition(currentStatus: WhitelistStatus, targetStatus: WhitelistStatus): boolean;
    calculateStatus(record: WhitelistRecord): WhitelistStatus;
    checkDuplicate(tenantId: string, apiGroupId: string, excludeId?: string): boolean;
    create(request: CreateWhitelistRequest): WhitelistRecord;
    findById(id: string): WhitelistRecord | undefined;
    findAll(filters?: {
        tenantId?: string;
        apiGroupId?: string;
        status?: WhitelistStatus;
    }): WhitelistRecord[];
    getHistories(recordId: string): import("../models/whitelist.model").WhitelistHistory[];
    approve(id: string, request: ApproveWhitelistRequest): WhitelistRecord;
    reject(id: string, approver: string, remark?: string): WhitelistRecord;
    revoke(id: string, operator: string, remark?: string): WhitelistRecord;
    resubmit(id: string, operator: string): WhitelistRecord;
    update(id: string, updates: UpdateWhitelistRequest, operator: string): WhitelistRecord;
    checkWhitelist(tenantId: string, apiGroupId: string): {
        allowed: boolean;
        rule?: RateLimitRule;
    };
    forceExpireCache(tenantId: string, apiGroupId: string): void;
    private updateCache;
    private clearCache;
    bulkImport(requests: CreateWhitelistRequest[]): {
        success: WhitelistRecord[];
        failed: {
            row: number;
            error: string;
            data: CreateWhitelistRequest;
        }[];
    };
    export(): WhitelistRecord[];
    refreshStatuses(): void;
    clearAll(): void;
    getCacheStats(): NodeCache.Stats;
}
export declare const whitelistService: WhitelistService;
