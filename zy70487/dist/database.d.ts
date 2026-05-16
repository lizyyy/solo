import { MessageRecord, BatchInfo, TempTicket, ReviewRecord } from './types';
interface DatabaseSchema {
    tempTickets: TempTicket[];
    messageRecords: MessageRecord[];
    batches: BatchInfo[];
    reviewRecords: ReviewRecord[];
}
declare class Database {
    private db;
    constructor();
    init(): Promise<void>;
    get data(): DatabaseSchema;
    write(): Promise<void>;
    saveTempTicket(ticket: TempTicket): Promise<TempTicket>;
    findTempTicketById(id: string): Promise<TempTicket | undefined>;
    findTempTicketByNo(ticketNo: string): Promise<TempTicket | undefined>;
    saveBatch(batch: BatchInfo): Promise<BatchInfo>;
    updateBatch(batchId: string, updates: Partial<BatchInfo>): Promise<void>;
    findBatchById(id: string): Promise<BatchInfo | undefined>;
    findAllBatches(): Promise<BatchInfo[]>;
    saveMessageRecord(record: MessageRecord): Promise<MessageRecord>;
    saveMessageRecords(records: MessageRecord[]): Promise<MessageRecord[]>;
    updateMessageRecord(id: string, updates: Partial<MessageRecord>): Promise<void>;
    findMessageRecordsByBatch(batchId: string): Promise<MessageRecord[]>;
    findMessageRecordById(id: string): Promise<MessageRecord | undefined>;
    findAllMessageRecords(): Promise<MessageRecord[]>;
    saveReviewRecord(record: ReviewRecord): Promise<ReviewRecord>;
    findReviewRecordsByMessage(messageId: string): Promise<ReviewRecord[]>;
}
export declare const db: Database;
export {};
