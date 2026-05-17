export declare enum WhitelistStatus {
    PENDING_APPROVAL = "pending_approval",
    ACTIVE = "active",
    EXPIRING_SOON = "expiring_soon",
    EXPIRED = "expired",
    REVOKED = "revoked",
    REJECTED = "rejected"
}
export declare enum RateLimitUnit {
    SECOND = "second",
    MINUTE = "minute",
    HOUR = "hour",
    DAY = "day"
}
export interface RateLimitRule {
    maxRequests: number;
    unit: RateLimitUnit;
    burstLimit?: number;
}
export interface WhitelistRecord {
    id: string;
    tenantId: string;
    tenantName: string;
    apiGroupId: string;
    apiGroupName: string;
    rateLimitRule: RateLimitRule;
    effectiveDate: Date;
    expiryDate: Date;
    status: WhitelistStatus;
    applicant: string;
    approver?: string;
    reason: string;
    remark?: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface WhitelistHistory {
    id: string;
    recordId: string;
    action: string;
    operator: string;
    oldValue?: Partial<WhitelistRecord>;
    newValue?: Partial<WhitelistRecord>;
    remark?: string;
    operatedAt: Date;
}
export interface CreateWhitelistRequest {
    tenantId: string;
    tenantName: string;
    apiGroupId: string;
    apiGroupName: string;
    rateLimitRule: RateLimitRule;
    effectiveDate: Date;
    expiryDate: Date;
    applicant: string;
    reason: string;
    remark?: string;
}
export interface ApproveWhitelistRequest {
    approver: string;
    remark?: string;
}
export interface UpdateWhitelistRequest {
    rateLimitRule?: RateLimitRule;
    effectiveDate?: Date;
    expiryDate?: Date;
    reason?: string;
    remark?: string;
}
export declare class WhitelistModel {
    private records;
    private histories;
    private historyByRecordId;
    create(request: CreateWhitelistRequest): WhitelistRecord;
    findById(id: string): WhitelistRecord | undefined;
    findAll(filters?: {
        tenantId?: string;
        apiGroupId?: string;
        status?: WhitelistStatus;
    }): WhitelistRecord[];
    findByTenantAndApiGroup(tenantId: string, apiGroupId: string): WhitelistRecord[];
    update(id: string, updates: UpdateWhitelistRequest, operator: string): WhitelistRecord | undefined;
    updateStatus(id: string, status: WhitelistStatus, operator: string, remark?: string): WhitelistRecord | undefined;
    approve(id: string, approver: string, remark?: string): WhitelistRecord | undefined;
    reject(id: string, approver: string, remark?: string): WhitelistRecord | undefined;
    revoke(id: string, operator: string, remark?: string): WhitelistRecord | undefined;
    getHistories(recordId: string): WhitelistHistory[];
    private addHistory;
    bulkImport(records: CreateWhitelistRequest[]): {
        success: WhitelistRecord[];
        failed: {
            row: number;
            error: string;
            data: CreateWhitelistRequest;
        }[];
    };
    export(): WhitelistRecord[];
    clear(): void;
}
export declare const whitelistModel: WhitelistModel;
