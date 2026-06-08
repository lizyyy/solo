import { HistoryRecord, Obstruction, CADLayerInfo, RangefinderRecord, EvacuationRoute } from '../types';
export interface FieldDiff<T = unknown> {
    field: string;
    oldValue: T;
    newValue: T;
    changed: boolean;
}
export interface EntityDiff {
    entityId: string;
    entityType: 'obstruction' | 'cad_layer' | 'rangefinder' | 'route';
    fields: FieldDiff[];
    hasChanges: boolean;
}
export type TrackableEntity = Obstruction | CADLayerInfo | RangefinderRecord | EvacuationRoute;
export declare class HistoryTracker {
    private records;
    private snapshots;
    saveSnapshot(entityId: string, entity: TrackableEntity): void;
    getSnapshot(entityId: string): TrackableEntity | undefined;
    clearSnapshot(entityId: string): void;
    trackChange<T>(params: {
        entityType: 'obstruction' | 'cad_layer' | 'rangefinder' | 'route';
        entityId: string;
        action: 'create' | 'update' | 'delete' | 'merge' | 'import';
        fieldName?: string;
        oldValue: T;
        newValue: T;
        operator: string;
        notes?: string;
        rollbackAvailable?: boolean;
    }): HistoryRecord<T>;
    trackObstructionUpdate(oldObstruction: Obstruction, newObstruction: Obstruction, operator: string, notes?: string): HistoryRecord[];
    getHistory(entityId?: string, entityType?: string): HistoryRecord[];
    getHistoryWithDiff(entityId: string): Array<HistoryRecord & {
        diffDescription: string;
    }>;
    getChangeSummary(entityId: string): {
        changedFields: string[];
        lastModified: number;
        lastOperator: string;
        changeCount: number;
    };
    canRollback(recordId: string): boolean;
    getRollbackValue(recordId: string): unknown;
    markRollbackUsed(recordId: string): void;
    getAllRecords(): HistoryRecord[];
}
export declare function compareObstructions(a: Obstruction, b: Obstruction): EntityDiff;
export declare function createFieldDiff<T>(field: string, oldValue: T, newValue: T): FieldDiff<T>;
export declare function deepEqual(a: unknown, b: unknown): boolean;
export declare function describeChange(record: HistoryRecord): string;
export declare function compareVersions<T extends TrackableEntity>(oldVersion: T, newVersion: T): {
    changed: boolean;
    changes: Array<{
        field: string;
        old: unknown;
        new: unknown;
    }>;
    readableDiff: string[];
};
