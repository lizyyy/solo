export declare enum CollectionStatus {
    NORMAL = "normal",
    FROZEN = "frozen",
    TRANSFERRING = "transferring"
}
export declare enum TransferStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    REJECTED = "rejected",
    CANCELED = "canceled",
    REVOKED = "revoked"
}
export declare enum RiskLevel {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high"
}
export declare enum FreezeType {
    USER = "user",
    COLLECTION = "collection"
}
export interface User {
    id: string;
    name: string;
    isVerified: boolean;
    isFrozen: boolean;
    createdAt: number;
    updatedAt: number;
}
export interface Collection {
    id: string;
    name: string;
    ownerId: string;
    status: CollectionStatus;
    lastTransferTime: number | null;
    createdAt: number;
    updatedAt: number;
}
export interface TransferRecord {
    id: string;
    collectionId: string;
    fromUserId: string;
    toUserId: string;
    status: TransferStatus;
    riskLevel: RiskLevel;
    riskReasons: string[];
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
}
export interface TransferHistory {
    id: string;
    transferId: string;
    fromUserId: string;
    toUserId: string;
    collectionId: string;
    statusAtTime: TransferStatus;
    eventType: 'create' | 'approve' | 'reject' | 'cancel' | 'revoke' | 'manual_correct';
    operatorId: string | null;
    operatorType: 'system' | 'user' | 'admin';
    timestamp: number;
    metadata: string;
}
export interface FreezeRecord {
    id: string;
    targetType: FreezeType;
    targetId: string;
    reason: string;
    operatorId: string;
    isActive: boolean;
    createdAt: number;
    releasedAt: number | null;
}
export interface AuditLog {
    id: string;
    action: string;
    actorId: string;
    actorType: 'system' | 'user' | 'admin';
    targetType: string;
    targetId: string;
    beforeState: string;
    afterState: string;
    timestamp: number;
    requestId: string;
}
export interface RiskCheckResult {
    passed: boolean;
    riskLevel: RiskLevel;
    reasons: string[];
}
