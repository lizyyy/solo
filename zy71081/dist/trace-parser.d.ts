import { Trace, ValidationError } from './types';
export interface TraceAnalysisResult {
    traces: Trace[];
    errors: ValidationError[];
    warnings: ValidationError[];
    missingFields: string[];
    fieldCaseIssues: Array<{
        field: string;
        occurrences: number;
        examples: string[];
    }>;
}
export declare class TraceParser {
    private errors;
    private warnings;
    private missingFieldsSet;
    private fieldCaseIssuesMap;
    parse(tracePath: string, targetService?: string): TraceAnalysisResult;
    private extractSpans;
    private extractSpansFromItem;
    private looksLikeSpan;
    private extractServiceName;
    private parseOTelSpan;
    private parseSpan;
    private getField;
    private checkFieldCase;
    private extractAttributeValue;
    private groupSpansByTrace;
    private buildResult;
}
