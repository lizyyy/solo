export type RecordStatus = 'pending' | 'imported' | 'dirty' | 'fixed' | 'rejected' | 'verified';
export type DirtyType = 'missing_field' | 'cross_date' | 'name_changed' | 'amount_conflict' | 'quantity_conflict' | 'duplicate';
export type SourceType = 'inspection' | 'repair_quote' | 'photo_list' | 'shift_record' | 'manual_price';
export type UserRole = 'entry' | 'review' | 'supervisor' | 'readonly';
export interface User {
    id: string;
    username: string;
    role: UserRole;
    name: string;
}
export interface InspectionRecord {
    id?: string;
    vin: string;
    carModel: string;
    plateNumber: string;
    inspector: string;
    inspectionDate: string;
    mileage: number;
    items: string;
    estimatedCost: number;
    sourceRow: number;
    sourceFile: string;
    status: RecordStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
    batchId: string;
}
export interface RepairQuoteRecord {
    id?: string;
    vin: string;
    plateNumber: string;
    repairShop: string;
    quoteDate: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    technician: string;
    sourceRow: number;
    sourceFile: string;
    status: RecordStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
    batchId: string;
}
export interface PhotoListRecord {
    id?: string;
    vin: string;
    plateNumber: string;
    photoDate: string;
    photoType: string;
    photoCount: number;
    photographer: string;
    sourceRow: number;
    sourceFile: string;
    status: RecordStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
    batchId: string;
}
export interface ShiftRecord {
    id?: string;
    vin: string;
    plateNumber: string;
    shiftDate: string;
    shiftType: string;
    worker: string;
    workHours: number;
    sourceRow: number;
    sourceFile: string;
    status: RecordStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
    batchId: string;
}
export interface ManualPriceRecord {
    id?: string;
    vin: string;
    plateNumber: string;
    itemName: string;
    originalPrice: number;
    adjustedPrice: number;
    adjustReason: string;
    adjustDate: string;
    adjustedBy: string;
    sourceRow: number;
    sourceFile: string;
    status: RecordStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy: string;
    batchId: string;
}
export interface DirtyRecord {
    id?: string;
    sourceType: SourceType;
    sourceId: string;
    dirtyType: DirtyType;
    fieldName?: string;
    originalValue?: string;
    expectedValue?: string;
    description: string;
    suggestion?: string;
    isFixed: boolean;
    fixedBy?: string;
    fixedAt?: string;
    fixedValue?: string;
    createdAt: string;
    batchId: string;
}
export interface HistoryRecord {
    id?: string;
    sourceType: SourceType;
    sourceId: string;
    action: string;
    beforeData?: string;
    afterData?: string;
    diff?: string;
    performedBy: string;
    performedAt: string;
    remark?: string;
}
export interface CarReturnRecord {
    vin: string;
    plateNumber: string;
    returnCount: number;
    firstEntryDate: string;
    lastReturnDate: string;
    totalCost: number;
    totalRevenue: number;
    profit: number;
    responsiblePersons: string[];
    records: {
        type: SourceType;
        date: string;
        person: string;
        amount: number;
    }[];
}
export interface ImportResult {
    success: number;
    failed: number;
    dirty: number;
    batchId: string;
    failedRecords: {
        row: number;
        reason: string;
        data: any;
    }[];
}
export interface PermissionConfig {
    visibleFields: Record<SourceType, string[]>;
    allowedActions: string[];
}
