import { NullabilityDiff, NullabilityChangeType, AffectedQuery, FailurePath, FieldTypeInfo } from './types';
export declare const NULLABILITY_RULES: Record<NullabilityChangeType, {
    code: string;
    name: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    clientImpact: string;
    fixPriority: string;
}>;
export declare function getRuleByChangeType(changeType: NullabilityChangeType): {
    code: string;
    name: string;
    description: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    clientImpact: string;
    fixPriority: string;
};
export declare function explainChange(change: NullabilityDiff): string;
export declare function generateFailurePaths(changes: NullabilityDiff[], affectedQueries: AffectedQuery[]): FailurePath[];
export declare function analyzeRiskLevel(changes: NullabilityDiff[]): {
    level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    score: number;
};
export declare function shouldFailBuild(changes: NullabilityDiff[], failOn: 'critical' | 'high' | 'medium' | 'any' | 'none'): boolean;
export declare function formatTypeChange(oldType: FieldTypeInfo, newType: FieldTypeInfo): string;
