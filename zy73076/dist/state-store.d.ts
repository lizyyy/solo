import { InspectionRecord, AnomalyQueueItem, DuplicateIdConfirmation } from './types';
export interface OperationLogEntry {
    timestamp: string;
    operator: 'assistant_xiaolin' | 'project_manager' | 'developer' | 'system';
    action: string;
    targetId: string;
    payload?: Record<string, unknown>;
}
export interface AppState {
    version: number;
    inspections: InspectionRecord[];
    anomalyQueue: AnomalyQueueItem[];
    duplicateConfirmations: DuplicateIdConfirmation[];
    operationLog: OperationLogEntry[];
    updatedAt: string;
}
export declare class AppStateStore {
    private filePath;
    private inMemory?;
    constructor(filePath?: string);
    initIfEmpty(initialInspections: InspectionRecord[]): AppState;
    read(): AppState;
    write(state: AppState): void;
    update(mutator: (state: AppState) => void): AppState;
    reset(initialInspections: InspectionRecord[]): AppState;
    log(state: AppState, operator: OperationLogEntry['operator'], action: string, targetId: string, payload?: Record<string, unknown>): void;
    updateRemark(state: AppState, recordId: string, remark: string): InspectionRecord | null;
    findInspection(state: AppState, recordId: string): InspectionRecord | null;
    replaceComputedState(state: AppState, newQueue: AnomalyQueueItem[], newConfirmations: DuplicateIdConfirmation[]): void;
    updateQueue(state: AppState, queueId: string, mutator: (q: AnomalyQueueItem) => AnomalyQueueItem): boolean;
    updateDuplicateConfirmation(state: AppState, dcId: string, mutator: (dc: DuplicateIdConfirmation) => DuplicateIdConfirmation): boolean;
    findQueue(state: AppState, queueId: string): AnomalyQueueItem | null;
    findDuplicateConfirmation(state: AppState, dcId: string): DuplicateIdConfirmation | null;
    getFilePath(): string;
}
