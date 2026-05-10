export type CaseStatus = 'in_stock' | 'in_transit' | 'lent_out' | 'under_repair' | 'lost' | 'damaged';
export type RecordStatus = 'active' | 'completed' | 'failed' | 'cancelled';
export type DamageSeverity = 'minor' | 'medium' | 'major' | 'critical';
export type RepairStatus = 'pending' | 'in_progress' | 'completed';
export interface EquipmentCase {
    id: string;
    caseNumber: string;
    name: string;
    description?: string;
    items: CaseItem[];
    currentCityId: string;
    status: CaseStatus;
    totalValue: number;
    createdAt: string;
    updatedAt: string;
}
export interface CaseItem {
    id: string;
    name: string;
    quantity: number;
    unitValue: number;
    serialNumber?: string;
    condition: 'new' | 'good' | 'fair' | 'poor';
}
export interface CityNode {
    id: string;
    name: string;
    code: string;
    description?: string;
    isActive: boolean;
}
export interface TourManifest {
    id: string;
    name: string;
    description?: string;
    caseIds: string[];
    citySequence: string[];
    currentCityIndex: number;
    status: 'draft' | 'in_progress' | 'completed';
    createdAt: string;
    updatedAt: string;
}
export interface BorrowRecord {
    id: string;
    caseId: string;
    fromCityId: string;
    toCityId?: string;
    borrowedBy: string;
    expectedReturnTime?: string;
    actualReturnTime?: string;
    itemsAtBorrow: CaseItem[];
    itemsAtReturn?: CaseItem[];
    status: RecordStatus;
    remarks?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DamageRecord {
    id: string;
    caseId: string;
    itemId?: string;
    cityId: string;
    reportedBy: string;
    severity: DamageSeverity;
    description: string;
    damageTime: string;
    responsibility?: string;
    isResolved: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
    resolution?: string;
    estimatedCost?: number;
    createdAt: string;
}
export interface RepairRecord {
    id: string;
    damageRecordId: string;
    caseId: string;
    itemId?: string;
    startedBy: string;
    startTime: string;
    endTime?: string;
    status: RepairStatus;
    cost?: number;
    description: string;
    createdAt: string;
    updatedAt: string;
}
export interface CompensationAction {
    id: string;
    relatedRecordId: string;
    relatedRecordType: 'borrow' | 'damage' | 'repair' | 'tour';
    actionType: string;
    description: string;
    parameters: Record<string, unknown>;
    attemptCount: number;
    maxAttempts: number;
    lastAttemptAt?: string;
    lastError?: string;
    status: 'pending' | 'in_progress' | 'success' | 'failed_permanent';
    createdAt: string;
    updatedAt: string;
}
export interface Database {
    equipmentCases: EquipmentCase[];
    cities: CityNode[];
    tourManifests: TourManifest[];
    borrowRecords: BorrowRecord[];
    damageRecords: DamageRecord[];
    repairRecords: RepairRecord[];
    compensationActions: CompensationAction[];
}
export interface ServiceResult<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    suggestions?: string[];
}
