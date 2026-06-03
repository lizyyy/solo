import { Obstruction, ConflictInfo, ConflictResolution } from '../types';
export declare const BOUNDARY_RULES: {
    readonly GEOMETRY_OVERLAP_THRESHOLD: 0.8;
    readonly POSITION_PROXIMITY_THRESHOLD: 0.5;
    readonly NAME_NORMALIZATION: {
        readonly TRIM_SPACES: true;
        readonly CASE_INSENSITIVE: true;
        readonly REMOVE_SPECIAL_CHARS: true;
    };
};
export interface ConflictDetectionResult {
    hasConflict: boolean;
    conflicts: Array<{
        type: 'duplicate_name' | 'overlapping_geometry' | 'inconsistent_attributes';
        obstructionIds: [string, string];
        details: Record<string, unknown>;
    }>;
}
export interface MergeResult {
    primary: Obstruction;
    mergedIds: string[];
    conflictsResolved: number;
}
export interface RollbackResult {
    success: boolean;
    restoredObstruction: Obstruction | null;
    message: string;
}
export declare function normalizeName(name: string): string;
export declare function detectConflicts(obstructions: Obstruction[], operator: string): {
    updated: Obstruction[];
    result: ConflictDetectionResult;
};
export declare function checkDuplicateName(a: Obstruction, b: Obstruction): {
    sharedNames: string[];
    normalizedMatches: string[];
} | null;
export declare function checkOverlappingGeometry(a: Obstruction, b: Obstruction): {
    overlapArea: number;
    threshold: number;
} | null;
export declare function resolveConflict(primary: Obstruction, secondary: Obstruction, resolution: ConflictResolution, operator: string, canonicalName?: string): MergeResult;
export declare function mergeObstructions(primary: Obstruction, secondary: Obstruction, operator: string, canonicalName?: string): Obstruction;
export declare function markAsDuplicate(obstruction: Obstruction, primaryId: string, operator: string): Obstruction;
export declare function rollbackMerge(mergedObstruction: Obstruction, originalPrimary: Obstruction, originalSecondary: Obstruction, operator: string): {
    primary: Obstruction;
    secondary: Obstruction;
};
export declare function requiresReview(obstruction: Obstruction): boolean;
export declare function canAutoResolve(conflict: ConflictInfo): boolean;
export declare function explainConflict(conflict: ConflictInfo): string;
export declare function getResolutionOptions(conflict: ConflictInfo): Array<{
    value: ConflictResolution;
    label: string;
    description: string;
}>;
