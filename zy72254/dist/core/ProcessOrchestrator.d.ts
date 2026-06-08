import { Obstruction, ProcessStage, DisplayMode, ImportSummary, HistoryRecord, UserFriendlyError, ConflictResolution } from '../types';
import { RawCADLayer } from './CADImporter';
import { ConflictDetectionResult } from './BoundaryRules';
import { HistoryTracker } from './HistoryTracker';
import { DisplayService } from './DisplayService';
import { ErrorCollector } from './ErrorHandler';
export interface ProcessState {
    currentStage: ProcessStage;
    obstructions: Obstruction[];
    pendingConflicts: ConflictDetectionResult | null;
    lastAction: string | null;
    lastOperator: string | null;
    stageHistory: Array<{
        stage: ProcessStage;
        timestamp: number;
        operator: string;
    }>;
}
export interface StageResult<T = unknown> {
    success: boolean;
    data?: T;
    errors: UserFriendlyError[];
    warnings: string[];
    nextStage?: ProcessStage;
    requiresReview?: boolean;
    reviewItems?: Array<{
        obstructionId: string;
        conflictType: string;
        description: string;
        conflictingNames: string[];
    }>;
}
export declare class ProcessOrchestrator {
    private state;
    private historyTracker;
    private displayService;
    private errorCollector;
    constructor();
    getState(): ProcessState;
    getHistoryTracker(): HistoryTracker;
    getDisplayService(): DisplayService;
    getErrorCollector(): ErrorCollector;
    step1_importCADLayers(rawLayers: RawCADLayer[], operator: string, source: string, isReimport?: boolean): Promise<StageResult<{
        summary: ImportSummary;
        obstructions: Obstruction[];
        conflictCount: number;
    }>>;
    step2_supplementRangefinder(records: Array<{
        obstructionId: string;
        measuredBy: string;
        distance: number;
        fromPoint: {
            x: number;
            y: number;
            z: number;
        };
        toPoint: {
            x: number;
            y: number;
            z: number;
        };
        notes?: string;
        accuracy?: number;
    }>, operator: string): Promise<StageResult<{
        updatedObstructions: Obstruction[];
        validRecords: number;
        invalidRecords: number;
    }>>;
    step3_update3DView(displayMode: DisplayMode, operator: string): Promise<StageResult<{
        displayItems: unknown[];
        chartData?: unknown;
        itemCount: number;
        itemsWithConflicts: number;
    }>>;
    resolvePendingConflict(primaryId: string, secondaryId: string, resolution: ConflictResolution, operator: string, canonicalName?: string): Promise<StageResult<{
        primary: Obstruction;
        secondary: Obstruction;
        merged: boolean;
    }>>;
    updateObstructionNotes(obstructionId: string, notes: string, operator: string): Promise<StageResult<{
        obstruction: Obstruction;
        history: HistoryRecord[];
    }>>;
    selectItemForReview(itemId: string, itemType: 'obstruction' | 'route'): Promise<StageResult<{
        detail: unknown;
        sourceTrace: unknown;
        canResolve: boolean;
    }>>;
    getObstructionHistory(obstructionId: string): Array<HistoryRecord & {
        diffDescription: string;
    }>;
    getPendingConflicts(): ConflictDetectionResult | null;
    canProceedToNextStage(): boolean;
    private refreshPendingConflicts;
    private recordStageTransition;
    private translateStage;
    private translateDisplayMode;
    private calculateDistance;
    private createResult;
}
