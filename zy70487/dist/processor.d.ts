import { MessageRecord, BatchInfo, ProcessingStatus, ProcessResult, TempTicket, Department, RiskType } from './types';
export declare class MessageProcessor {
    createTempTicket(params: {
        ticketNo: string;
        applicant: string;
        department: Department;
        permissionType: string;
        reason: string;
        startTime: Date;
        endTime: Date;
        createdBy: string;
    }): Promise<TempTicket>;
    createBatch(params: {
        batchNo: string;
        name: string;
        operator: string;
        records: Array<{
            phone: string;
            idCard: string;
            userName: string;
            content: string;
            riskType: RiskType;
            riskScore: number;
            riskReason: string;
        }>;
        ticketId: string;
    }): Promise<BatchInfo>;
    previewBatch(batchId: string): Promise<ProcessResult>;
    processBatch(batchId: string): Promise<ProcessResult>;
    getEffectiveStatus(record: MessageRecord): ProcessingStatus;
    reviewMessage(params: {
        messageId: string;
        reviewer: string;
        reviewOpinion: string;
        serviceTicketNo: string;
        newConclusion: ProcessingStatus;
    }): Promise<{
        id: string;
        messageId: string;
        reviewer: string;
        reviewOpinion: string;
        serviceTicketNo: string;
        originalConclusion: ProcessingStatus;
        newConclusion: ProcessingStatus;
        reviewedAt: Date;
    }>;
    queryRecords(filters?: {
        batchId?: string;
        operator?: string;
        riskType?: RiskType;
        status?: ProcessingStatus;
    }): Promise<MessageRecord[]>;
    queryBatches(): Promise<BatchInfo[]>;
    getRecordDetail(recordId: string): Promise<{
        record: MessageRecord;
        reviews: import("./types").ReviewRecord[];
    } | null>;
}
export declare const processor: MessageProcessor;
