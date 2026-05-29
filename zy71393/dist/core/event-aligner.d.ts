import { EventDefinition, EventLogEntry, Issue } from '../types';
export interface AlignResult {
    matchedEvents: Map<string, EventLogEntry[]>;
    missingEvents: EventDefinition[];
    deprecatedEvents: EventDefinition[];
    renamedEvents: Map<string, EventDefinition>;
    issues: Issue[];
}
export declare class EventAligner {
    private manifest;
    private logEntries;
    constructor(manifest: EventDefinition[], logEntries: EventLogEntry[]);
    align(): AlignResult;
    private buildLogEventMap;
    private findRenamedMatch;
    private calculateSimilarity;
    private createMissingIssue;
    private getMissingSeverity;
    private getImpactScope;
    private createRenamedIssue;
    private createDeprecatedIssue;
    private createRenameNotAppliedIssue;
}
