import { DirtyRecord, DirtyType, SourceType } from '../types';
interface CheckResult {
    dirtyType: DirtyType;
    fieldName?: string;
    originalValue?: string;
    expectedValue?: string;
    description: string;
    suggestion?: string;
}
export declare function checkMissingFields(data: any, requiredFields: string[]): CheckResult | null;
export declare function checkCrossDate(dateStr: string, referenceDate: string, dateField: string): CheckResult | null;
export declare function checkNameChanged(currentName: string, previousName: string, nameField: string, vin: string): CheckResult | null;
export declare function checkAmountConflict(currentAmount: number, expectedAmount: number, amountField: string, tolerance?: number): CheckResult | null;
export declare function checkQuantityConflict(currentQty: number, expectedQty: number, qtyField: string): CheckResult | null;
export declare function checkDuplicate(sourceType: SourceType, uniqueKey: string, keyValue: string): Promise<CheckResult | null>;
export declare function saveDirtyRecord(sourceType: SourceType, sourceId: string, checkResult: CheckResult, batchId: string): Promise<string>;
export declare function getDirtyRecords(sourceType?: SourceType, isFixed?: boolean): Promise<DirtyRecord[]>;
export declare function fixDirtyRecord(dirtyId: string, fixedValue: string, fixedBy: string): Promise<boolean>;
export declare function getDirtyStats(): Promise<{
    total: number;
    byType: Record<DirtyType, number>;
    bySource: Record<SourceType, number>;
    fixed: number;
    pending: number;
}>;
export {};
