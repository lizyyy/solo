import { BorrowRecord, ServiceResult } from '../types';
export interface BorrowInput {
    caseIdentifier: string;
    borrowedBy: string;
    toCityIdentifier?: string;
    expectedReturnTime?: string;
    remarks?: string;
}
export declare function borrowCase(input: BorrowInput): ServiceResult<BorrowRecord>;
export interface ReturnInput {
    caseIdentifier: string;
    returnedToCityIdentifier?: string;
    itemsAtReturn?: {
        name: string;
        quantity: number;
        unitValue: number;
        serialNumber?: string;
        condition?: 'new' | 'good' | 'fair' | 'poor';
    }[];
    remarks?: string;
}
export interface ReturnResult {
    record: BorrowRecord;
    missingItems: {
        name: string;
        expectedQty: number;
        actualQty: number;
        difference: number;
    }[];
    conditionChanges: {
        name: string;
        oldCondition: string;
        newCondition: string;
    }[];
}
export declare function returnCase(input: ReturnInput): ServiceResult<ReturnResult>;
export declare function getActiveBorrow(caseIdentifier: string): ServiceResult<BorrowRecord>;
export declare function listBorrowRecords(caseIdentifier?: string, statusFilter?: string): ServiceResult<BorrowRecord[]>;
