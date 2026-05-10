import { Bill } from '../types';
declare class BillService {
    createBill(billData: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deleted'>, userId: string, clientId: string, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<Bill>;
    private findBillByCorrelationId;
    updateBill(billId: string, updates: Partial<Bill>, userId: string, clientId: string, expectedVersion: number, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<Bill>;
    private findUpdateByCorrelationId;
    deleteBill(billId: string, userId: string, clientId: string, expectedVersion: number, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<void>;
    getBillById(billId: string): Bill | null;
    getBillsByGroup(groupId: string): Bill[];
    calculateBalances(groupId: string): Map<string, number>;
    calculateSettlementSuggestions(balances: Map<string, number>): Array<{
        from: string;
        to: string;
        amount: number;
    }>;
    private validateBillAmounts;
    private persistBill;
    private updatePersistedBill;
    private deserializeBill;
}
export declare const billService: BillService;
export {};
