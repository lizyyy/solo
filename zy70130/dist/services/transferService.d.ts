import { TransferRecord, TransferStatus, TransferHistory } from '../types';
export interface CreateTransferRequest {
    collectionId: string;
    fromUserId: string;
    toUserId: string;
    requestId?: string;
}
export interface TransferDetail {
    transfer: TransferRecord;
    history: TransferHistory[];
}
export declare class TransferService {
    createTransfer(req: CreateTransferRequest): TransferRecord;
    approveTransfer(transferId: string, operatorId: string): TransferRecord;
    cancelTransfer(transferId: string, operatorId: string): TransferRecord;
    revokeTransfer(transferId: string, adminId: string, reason: string): TransferRecord;
    manualCorrectTransfer(transferId: string, newStatus: TransferStatus, adminId: string, reason: string): TransferRecord;
    getTransfer(id: string): TransferRecord | null;
    getTransferDetail(id: string): TransferDetail | null;
    getTransferHistory(transferId: string): TransferHistory[];
    getTransfersByUser(userId: string, status?: TransferStatus): TransferRecord[];
    getTransfersByCollection(collectionId: string): TransferRecord[];
    getUserTransferHistoryAtTime(userId: string, timestamp: number): TransferHistory[];
    getUserTransferCountInRange(userId: string, startTime: number, endTime: number): number;
    private getUserTransferFrequency;
    private addHistory;
}
export declare const transferService: TransferService;
