import { EventLogEntry, Issue } from '../types';
import { ValidationConfig } from '../types';
export interface PagePathValidationResult {
    matches: boolean;
    expected: string;
    actual: string;
    normalizedExpected: string;
    normalizedActual: string;
}
export declare class PagePathValidator {
    private config;
    constructor(config: ValidationConfig);
    validate(expectedPath: string, entries: EventLogEntry[]): {
        result: PagePathValidationResult;
        issues: Issue[];
    };
    private checkPathMatch;
    private normalizePath;
    private createMissingPathIssue;
    private createMismatchIssue;
}
