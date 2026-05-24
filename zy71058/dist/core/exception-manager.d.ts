import { Finding, ExceptionItem } from '../types';
export declare function isExceptionExpired(exception: ExceptionItem): boolean;
export declare function matchesException(finding: Finding, exception: ExceptionItem, environment: string): boolean;
export declare function applyExceptions(findings: Finding[], exceptions: ExceptionItem[], environment: string): {
    findings: Finding[];
    exceptedCount: number;
    expiredCount: number;
};
export declare function validateException(exception: ExceptionItem): string[];
export declare function getExceptionSummary(exception: ExceptionItem): string;
