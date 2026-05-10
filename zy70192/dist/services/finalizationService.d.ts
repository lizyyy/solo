import { FinalizationRecord, ReturnRecord, ReturnType } from '../types';
export declare const finalizeSample: (data: {
    sampleId: string;
    finalQuantity: number;
    finalUnitPrice: number;
    remarks?: string;
    attachments?: string[];
}, operator: string) => FinalizationRecord;
export declare const getFinalizationById: (id: string) => FinalizationRecord;
export declare const getFinalizationBySample: (sampleId: string) => FinalizationRecord | null;
export declare const listFinalizations: (params?: {
    sampleId?: string;
    approvedBy?: string;
    startTime?: string;
    endTime?: string;
}, page?: number, pageSize?: number) => {
    items: FinalizationRecord[];
    total: number;
};
export declare const createReturnRecord: (data: {
    sampleId: string;
    returnType: ReturnType;
    returnReason: string;
    returnQuantity: number;
    trackingNo?: string;
    remarks?: string;
}, operator: string) => ReturnRecord;
export declare const getReturnRecordById: (id: string) => ReturnRecord;
export declare const getReturnRecordsBySample: (sampleId: string) => ReturnRecord[];
export declare const confirmReturnReceipt: (id: string, operator: string) => ReturnRecord;
export declare const listReturnRecords: (params?: {
    sampleId?: string;
    returnType?: ReturnType;
    returnedBy?: string;
    startTime?: string;
    endTime?: string;
    isReceived?: boolean;
}, page?: number, pageSize?: number) => {
    items: ReturnRecord[];
    total: number;
};
