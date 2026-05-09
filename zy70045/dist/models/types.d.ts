export type ShiftStatus = 'active' | 'handover' | 'confirmed' | 'revised';
export type DowntimeStatus = 'pending' | 'allocated' | 'revised';
export type WasteStatus = 'pending' | 'confirmed' | 'revised';
export type ProductionStatus = 'pending' | 'confirmed' | 'revised';
export interface Shift {
    id: string;
    lineId: string;
    teamId: string;
    teamName: string;
    startTime: Date;
    endTime?: Date;
    status: ShiftStatus;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface ProductionRecord {
    id: string;
    shiftId: string;
    productId: string;
    productName: string;
    quantity: number;
    timestamp: Date;
    status: ProductionStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface WasteRecord {
    id: string;
    shiftId: string;
    productId: string;
    productName: string;
    quantity: number;
    reason: string;
    timestamp: Date;
    status: WasteStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface DowntimeRecord {
    id: string;
    lineId: string;
    startTime: Date;
    endTime?: Date;
    durationMinutes: number;
    reason: string;
    status: DowntimeStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
export interface DowntimeAllocation {
    id: string;
    downtimeId: string;
    shiftId: string;
    durationMinutes: number;
    percentage: number;
    allocatedAt: Date;
}
export interface RevisionRecord {
    id: string;
    targetId: string;
    targetType: 'shift' | 'production' | 'waste' | 'downtime' | 'allocation';
    previousVersion: number;
    newVersion: number;
    changes: Record<string, {
        from: unknown;
        to: unknown;
    }>;
    revisedBy: string;
    revisedAt: Date;
    reason: string;
}
export interface ShiftSnapshot {
    id: string;
    shiftId: string;
    shiftVersion: number;
    snapshotTime: Date;
    productionTotal: number;
    wasteTotal: number;
    effectiveTimeMinutes: number;
    downtimeAllocations: Array<{
        downtimeId: string;
        durationMinutes: number;
    }>;
    productionRecords: Array<{
        id: string;
        productId: string;
        quantity: number;
    }>;
    wasteRecords: Array<{
        id: string;
        productId: string;
        quantity: number;
        reason: string;
    }>;
    handoverFrom?: string;
    handoverTo?: string;
    isConfirmed: boolean;
}
export interface DailyReport {
    date: string;
    lineId: string;
    shifts: Array<{
        shiftId: string;
        teamId: string;
        teamName: string;
        startTime: Date;
        endTime: Date;
        productionTotal: number;
        wasteTotal: number;
        effectiveRate: number;
        netProduction: number;
    }>;
    dailyTotal: {
        production: number;
        waste: number;
        netProduction: number;
        downtimeMinutes: number;
    };
}
//# sourceMappingURL=types.d.ts.map