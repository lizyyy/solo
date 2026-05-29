import { EventLogEntry, Issue } from '../types';
import { ValidationConfig } from '../types';
export interface SamplingDelayResult {
    hasDelay: boolean;
    averageDelayMs: number;
    maxDelayMs: number;
    minDelayMs: number;
    firstSeen: number;
    lastSeen: number;
    totalDurationMs: number;
}
export declare class SamplingDelayDetector {
    private config;
    constructor(config: ValidationConfig);
    detect(entries: EventLogEntry[]): {
        result: SamplingDelayResult;
        issues: Issue[];
    };
    private createDelayIssue;
    private getDelaySeverity;
    private formatDelay;
}
