import { ReconciliationBatch, MatchRecord, PassengerLostItem, DriverTurnedInItem, WarehouseItem, RouteSchedule, ItemStatus, ReportData, DifferenceType } from '../types';
export declare class ReconciliationService {
    private batches;
    private batchMatches;
    private batchPassengerItems;
    private batchDriverItems;
    private batchWarehouseItems;
    private batchRouteSchedules;
    private matchingEngine;
    private reviewService;
    constructor();
    createBatch(name: string, createdBy: string, passengerItems: PassengerLostItem[], driverItems: DriverTurnedInItem[], warehouseItems: WarehouseItem[], routeSchedules?: RouteSchedule[]): ReconciliationBatch;
    runMatching(batchId: string): MatchRecord[];
    recalculateMatching(batchId: string): MatchRecord[];
    getBatch(batchId: string): ReconciliationBatch | undefined;
    getBatchMatches(batchId: string): MatchRecord[];
    getMatchDetail(batchId: string, matchId: string): {
        match: MatchRecord | undefined;
        passengerItem: PassengerLostItem | undefined;
        driverItem: DriverTurnedInItem | undefined;
        warehouseItem: WarehouseItem | undefined;
        reviewHistory: any[];
    };
    updateMatchStatus(batchId: string, matchId: string, status: ItemStatus, reviewer: string, reason: string): MatchRecord | null;
    approveMatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null;
    rejectMatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null;
    manualMatch(batchId: string, matchId: string, reviewer: string, reason: string, targetIds: {
        passengerItemId?: string;
        driverItemId?: string;
        warehouseItemId?: string;
    }): MatchRecord | null;
    unmatch(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null;
    requestMoreInfo(batchId: string, matchId: string, reviewer: string, reason: string): MatchRecord | null;
    private updateMatchInBatch;
    private updateBatchStatistics;
    completeBatch(batchId: string): ReconciliationBatch | null;
    getAllBatches(): ReconciliationBatch[];
    generateReport(batchId: string): ReportData;
    private calculateDifferenceBreakdown;
    getBatchItems(batchId: string): {
        passengerItems: PassengerLostItem[];
        driverItems: DriverTurnedInItem[];
        warehouseItems: WarehouseItem[];
    };
    searchMatches(batchId: string, filters: {
        status?: ItemStatus;
        hasDifference?: DifferenceType;
        isOverdue?: boolean;
        itemName?: string;
    }): MatchRecord[];
}
