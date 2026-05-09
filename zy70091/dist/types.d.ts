export type ArrearsStatus = 'pending' | 'merging' | 'merged' | 'collecting' | 'paid' | 'partially_paid' | 'blacklisted' | 'withdrawn';
export type PaymentChannel = 'wechat' | 'alipay' | 'bank' | 'cash' | 'third_party';
export type CollectionActionType = 'notify' | 'reminder' | 'legal_notice' | 'blacklist' | 'withdraw';
export type RecordSource = 'manual' | 'system' | 'import' | 'callback';
export interface ParkingRecord {
    id: string;
    plateNumber: string;
    parkingLotId: string;
    parkingLotName: string;
    berthId: string;
    berthNumber: string;
    entryTime: Date;
    exitTime: Date;
    durationMinutes: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    paymentStatus: 'paid' | 'partial' | 'unpaid';
    paymentChannel?: PaymentChannel;
    recognizedPlates: PlateRecognition[];
    isRecognizedPlate: boolean;
    source: RecordSource;
    batchId?: string;
    importedAt?: Date;
    createdAt: Date;
}
export interface PlateRecognition {
    id: string;
    parkingRecordId: string;
    plateNumber: string;
    confidence: number;
    recognitionTime: Date;
    isPrimary: boolean;
    source: 'camera' | 'manual';
}
export interface ArrearsGroup {
    id: string;
    plateNumber: string;
    normalizedPlate: string;
    totalUnpaidAmount: number;
    recordCount: number;
    status: ArrearsStatus;
    latestParkingTime: Date;
    firstUnpaidTime: Date;
    mergedRecordIds: string[];
    batchId?: string;
    lastCollectionTime?: Date;
    collectionCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CollectionRecord {
    id: string;
    arrearsGroupId: string;
    plateNumber: string;
    actionType: CollectionActionType;
    actionResult: 'success' | 'failed' | 'pending';
    channel: string;
    message?: string;
    operator?: string;
    source: RecordSource;
    batchId?: string;
    triggeredAt: Date;
    completedAt?: Date;
}
export interface PaymentCallback {
    id: string;
    externalOrderId: string;
    arrearsGroupId?: string;
    plateNumber: string;
    amount: number;
    paymentChannel: PaymentChannel;
    paymentTime: Date;
    callbackTime: Date;
    source: RecordSource;
    processed: boolean;
    processedAt?: Date;
    batchId?: string;
}
export interface BlacklistRecord {
    id: string;
    plateNumber: string;
    arrearsGroupId: string;
    totalUnpaidAmount: number;
    recordCount: number;
    addedTime: Date;
    removedTime?: Date;
    status: 'active' | 'removed';
    source: RecordSource;
    syncStatus: 'synced' | 'pending' | 'failed';
    syncMessage?: string;
    syncedAt?: Date;
}
export interface CollectionReport {
    id: string;
    reportDate: Date;
    generatedAt: Date;
    totalRecords: number;
    totalAmount: number;
    collectedAmount: number;
    pendingAmount: number;
    blacklistCount: number;
    newArrearsCount: number;
    paidCount: number;
    summary: string;
}
export interface OperationHistory {
    id: string;
    entityType: 'parking_record' | 'arrears_group' | 'collection_record' | 'payment_callback' | 'blacklist_record';
    entityId: string;
    operationType: 'create' | 'update' | 'delete' | 'withdraw' | 'reimport';
    beforeData?: string;
    afterData?: string;
    reason?: string;
    operator?: string;
    source: RecordSource;
    batchId?: string;
    createdAt: Date;
}
export interface BatchOperation {
    id: string;
    name: string;
    operationType: 'import' | 'collect' | 'sync' | 'withdraw';
    status: 'processing' | 'completed' | 'failed';
    totalCount: number;
    successCount: number;
    failedCount: number;
    startedAt: Date;
    completedAt?: Date;
    resultSummary?: string;
}
export interface OperationResult {
    success: boolean;
    message: string;
    data?: any;
    warnings?: string[];
}
