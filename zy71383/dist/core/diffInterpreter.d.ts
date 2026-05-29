import { DiffDetail } from './types';
interface Interpretation {
    summary: string;
    impact: string;
    rootCause: string;
    suggestedActions: string[];
    priority: 'immediate' | 'soon' | 'scheduled' | 'none';
}
export declare class DiffInterpreter {
    interpret(diff: DiffDetail): Interpretation;
    private generateRootCause;
    private analyzeSecretRootCause;
    private analyzeDefaultValueRootCause;
    private analyzeMissingKeyRootCause;
    private analyzeExtraKeyRootCause;
    private analyzeTypeMismatchRootCause;
    private analyzeValueMismatchRootCause;
    private generateSuggestedActions;
    formatForDisplay(diff: DiffDetail): string;
    private getSeverityEmoji;
    private getPriorityLabel;
}
export declare const interpreter: DiffInterpreter;
export {};
