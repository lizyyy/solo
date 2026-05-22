import { PassengerLostItem, DriverTurnedInItem, WarehouseItem, MatchRecord, RouteSchedule } from '../types';
export declare class MatchingEngine {
    private readonly OVERDUE_DAYS;
    private readonly MATCH_THRESHOLD;
    private readonly SENSITIVE_KEYWORDS;
    private fuseOptions;
    matchPassengerToDriver(passengerItems: PassengerLostItem[], driverItems: DriverTurnedInItem[], routeSchedules: RouteSchedule[]): MatchRecord[];
    matchDriverToWarehouse(driverItems: DriverTurnedInItem[], warehouseItems: WarehouseItem[], existingMatches: MatchRecord[]): MatchRecord[];
    private findDriverCandidates;
    private findWarehouseCandidates;
    private createMatchRecord;
    private createUnmatchedRecord;
    private isDateMatch;
    private isSameNameMatch;
    private checkOverdue;
    private checkSensitiveInfo;
    updateOverdueStatus(matches: MatchRecord[], allItems: any[]): MatchRecord[];
    private getRelevantDate;
}
