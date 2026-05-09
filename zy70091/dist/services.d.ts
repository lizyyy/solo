import * as Types from './types';
import { DatabaseConnection } from './database';
export interface ImportRecordInput {
    plateNumber: string;
    parkingLotId: string;
    parkingLotName: string;
    berthId: string;
    berthNumber: string;
    entryTime: Date;
    exitTime: Date;
    totalAmount: number;
    paidAmount: number;
    isRecognizedPlate?: boolean;
    recognitionConfidence?: number;
}
export interface ImportResult {
    success: boolean;
    batchId: string;
    totalRecords: number;
    newRecords: number;
    skippedRecords: number;
    unpaidAmount: number;
    message: string;
    warnings: string[];
}
export interface CollectionResult {
    plateNumber: string;
    totalUnpaid: number;
    actions: Array<{
        type: Types.CollectionActionType;
        channel: string;
        result: string;
        message?: string;
    }>;
    status: string;
}
export interface WithdrawResult {
    success: boolean;
    plateNumber: string;
    reason: string;
    message: string;
}
export declare class ArrearsService {
    private db;
    private parkingRepo;
    private arrearsRepo;
    private collectionRepo;
    private paymentRepo;
    private blacklistRepo;
    private reportRepo;
    private batchRepo;
    private historyRepo;
    constructor(dbConnection?: DatabaseConnection);
    importRecords(records: ImportRecordInput[], options?: {
        batchId?: string;
        operator?: string;
    }): ImportResult;
    private generateRecordFingerprint;
    private generateInputFingerprint;
    private getBatchRecords;
    private calculateDuration;
    private mergeArrearsForBatch;
    private mergeOrUpdateArrearsGroup;
    private getMergedRecords;
    private deduplicateRecords;
    getArrearsGroup(plateNumber: string): Types.ArrearsGroup | null;
    getPendingArrears(): Types.ArrearsGroup[];
    performCollection(plateNumber: string, options?: {
        actionType?: Types.CollectionActionType;
        operator?: string;
    }): CollectionResult;
    private determineActionType;
    private executeCollectionAction;
    private getChannelForAction;
    private getMessageForAction;
    private updateStatusAfterCollection;
    processPaymentCallback(externalOrderId: string, plateNumber: string, amount: number, paymentChannel: Types.PaymentChannel, paymentTime: Date, options?: {
        operator?: string;
    }): {
        success: boolean;
        message: string;
        data?: any;
    };
    private applyPaymentToGroup;
    withdrawArrears(plateNumber: string, reason: string, options?: {
        operator?: string;
    }): WithdrawResult;
    getOperationHistory(plateNumber: string): Array<{
        time: string;
        operation: string;
        operator?: string;
        reason?: string;
    }>;
    private translateOperation;
    generateReport(): Types.CollectionReport;
    formatArrearsDetail(plateNumber: string): string;
}
