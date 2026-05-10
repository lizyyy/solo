import { ServiceResult } from '../types';
export interface InventoryReport {
    totalCases: number;
    totalValue: number;
    byStatus: Record<string, {
        count: number;
        value: number;
    }>;
    byCity: Array<{
        cityId: string;
        cityName: string;
        cityCode: string;
        count: number;
        value: number;
    }>;
    itemsSummary: Array<{
        name: string;
        totalQuantity: number;
        totalValue: number;
    }>;
}
export interface AuditReport {
    totalBorrowRecords: number;
    activeBorrowCount: number;
    completedBorrowCount: number;
    totalDamageRecords: number;
    unresolvedDamageCount: number;
    totalRepairRecords: number;
    inProgressRepairCount: number;
    totalCompensationActions: number;
    pendingCompensationCount: number;
    permanentFailedCompensationCount: number;
    totalTours: number;
    activeToursCount: number;
    completedToursCount: number;
}
export interface CaseHistoryReport {
    caseNumber: string;
    caseName: string;
    currentStatus: string;
    currentCity: string;
    totalValue: number;
    borrowHistory: Array<{
        id: string;
        fromCity: string;
        toCity: string;
        borrowedBy: string;
        borrowTime: string;
        returnTime?: string;
        status: string;
    }>;
    damageHistory: Array<{
        id: string;
        city: string;
        severity: string;
        reportedBy: string;
        reportedTime: string;
        isResolved: boolean;
    }>;
    repairHistory: Array<{
        id: string;
        startedBy: string;
        startTime: string;
        endTime?: string;
        status: string;
        cost?: number;
    }>;
}
export declare function getInventoryReport(): ServiceResult<InventoryReport>;
export declare function getAuditReport(): ServiceResult<AuditReport>;
export declare function getCaseHistoryReport(caseIdentifier: string): ServiceResult<CaseHistoryReport>;
