export declare enum InitStep {
    VALIDATE_PACKAGE = "VALIDATE_PACKAGE",
    EXTRACT_FILES = "EXTRACT_FILES",
    PARSE_METADATA = "PARSE_METADATA",
    CREATE_TENANT = "CREATE_TENANT",
    IMPORT_DEVICES = "IMPORT_DEVICES",
    CONFIGURE_PERMISSIONS = "CONFIGURE_PERMISSIONS",
    FINALIZE = "FINALIZE"
}
export declare enum ProcessingStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SUCCESS = "SUCCESS",
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
    FAILED = "FAILED"
}
export declare enum ItemStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    SKIPPED = "SKIPPED"
}
export interface TenantInitRecord {
    id: string;
    tenantId: string;
    tenantName: string;
    packagePath: string;
    status: ProcessingStatus;
    currentStep: InitStep | null;
    errorMessage: string | null;
    materialSummary: string;
    totalItems: number;
    successItems: number;
    failedItems: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}
export interface InitDetailItem {
    id: string;
    recordId: string;
    itemType: string;
    itemId: string;
    itemName: string;
    status: ItemStatus;
    errorMessage: string | null;
    step: InitStep;
    rawData: string;
    createdAt: Date;
}
export interface ApprovalNode {
    id: string;
    recordId: string;
    nodeName: string;
    nodeOrder: number;
    approver: string;
    approvedAt: Date | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comment: string | null;
}
export interface AttachmentRevision {
    id: string;
    recordId: string;
    detailItemId: string;
    attachmentName: string;
    beforeValue: string;
    afterValue: string;
    modifiedBy: string;
    modifiedAt: Date;
    approvalNodeId: string | null;
}
export interface RollbackCandidate {
    id: string;
    recordId: string;
    itemType: string;
    itemId: string;
    itemName: string;
    reason: string;
    createdAt: Date;
}
export interface DeviceLedger {
    id: string;
    tenantId: string;
    deviceCode: string;
    deviceName: string;
    deviceType: string;
    storeName: string;
    installLocation: string;
    status: string;
    purchaseDate: Date;
    warrantyPeriod: number;
    manufacturer: string;
    model: string;
}
