import { PlaceholderIssue } from './types';
export declare function checkPlaceholders(sourceText: string, targetText: string, expectedPlaceholders?: string[]): PlaceholderIssue[];
export declare function validatePlaceholderOrder(sourceText: string, targetText: string): PlaceholderIssue[];
export declare function estimatePlaceholderMaxWidth(placeholder: string, estimatedLength?: number): number;
export declare function getPlaceholderIssuesSummary(issues: PlaceholderIssue[]): string;
