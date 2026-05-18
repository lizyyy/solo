export interface ShuttleRegistration {
    employeeId: string;
    employeeName: string;
    department: string;
    phone: string;
    routeName: string;
    boardingPoint: string;
    boardingTime: string;
    registrationDate: string;
    status: ShuttleStatus;
    rawData: Record<string, unknown>;
    sourceFile: string;
    rowNumber: number;
}
export type ShuttleStatus = '正常' | '调岗' | '待审核' | '已取消';
export interface DedupKey {
    type: 'employeeId' | 'phone' | 'nameAndPhone';
    value: string;
}
export interface DuplicateRecord {
    original: ShuttleRegistration;
    duplicates: ShuttleRegistration[];
    reason: string;
    key: DedupKey;
}
export interface TransferRecord {
    employeeId: string;
    employeeName: string;
    oldRoute: string;
    newRoute: string;
    oldBoardingPoint: string;
    newBoardingPoint: string;
    transferDate: string;
}
export interface SharedPhoneRecord {
    phone: string;
    employees: Array<{
        employeeId: string;
        employeeName: string;
        department: string;
        routeName: string;
    }>;
}
export interface ProcessResult {
    totalRecords: number;
    validRecords: number;
    duplicateRecords: DuplicateRecord[];
    transferRecords: TransferRecord[];
    sharedPhoneRecords: SharedPhoneRecord[];
    invalidRecords: InvalidRecord[];
    outputPath: string;
    reportPath: string;
    runId: string;
    processedAt: Date;
}
export interface InvalidRecord {
    sourceFile: string;
    rowNumber: number;
    rawData: Record<string, unknown>;
    errors: string[];
}
export type EncodingType = 'UTF-8' | 'GBK' | 'GB2312' | 'Auto';
export interface ImportOptions {
    encoding?: EncodingType;
    delimiter?: string;
    hasHeader?: boolean;
}
export interface ColumnMapping {
    employeeId: string[];
    employeeName: string[];
    department: string[];
    phone: string[];
    routeName: string[];
    boardingPoint: string[];
    boardingTime: string[];
    registrationDate: string[];
    status: string[];
}
export declare const DEFAULT_COLUMN_MAPPING: ColumnMapping;
