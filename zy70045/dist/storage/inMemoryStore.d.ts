import { Shift, ProductionRecord, WasteRecord, DowntimeRecord, DowntimeAllocation, RevisionRecord, ShiftSnapshot } from '../models/types';
export declare class InMemoryStore {
    private shifts;
    private productions;
    private wastes;
    private downtimes;
    private allocations;
    private revisions;
    private snapshots;
    reset(): void;
    generateId(): string;
    saveShift(shift: Shift): Shift;
    getShiftById(id: string): Shift | undefined;
    getShiftsByLine(lineId: string): Shift[];
    getActiveShift(lineId: string): Shift | undefined;
    saveProduction(production: ProductionRecord): ProductionRecord;
    getProductionById(id: string): ProductionRecord | undefined;
    getProductionsByShift(shiftId: string): ProductionRecord[];
    saveWaste(waste: WasteRecord): WasteRecord;
    getWasteById(id: string): WasteRecord | undefined;
    getWastesByShift(shiftId: string): WasteRecord[];
    saveDowntime(downtime: DowntimeRecord): DowntimeRecord;
    getDowntimeById(id: string): DowntimeRecord | undefined;
    getDowntimesByLine(lineId: string): DowntimeRecord[];
    getDowntimesInTimeRange(lineId: string, startTime: Date, endTime: Date): DowntimeRecord[];
    saveAllocation(allocation: DowntimeAllocation): DowntimeAllocation;
    getAllocationsByDowntime(downtimeId: string): DowntimeAllocation[];
    getAllocationsByShift(shiftId: string): DowntimeAllocation[];
    saveRevision(revision: RevisionRecord): RevisionRecord;
    getRevisionsByTarget(targetId: string, targetType: RevisionRecord['targetType']): RevisionRecord[];
    saveSnapshot(snapshot: ShiftSnapshot): ShiftSnapshot;
    getSnapshotByShiftVersion(shiftId: string, shiftVersion: number): ShiftSnapshot | undefined;
    getSnapshotsByShift(shiftId: string): ShiftSnapshot[];
    getLatestSnapshot(shiftId: string): ShiftSnapshot | undefined;
}
export declare const store: InMemoryStore;
//# sourceMappingURL=inMemoryStore.d.ts.map