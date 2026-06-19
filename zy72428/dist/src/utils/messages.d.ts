import { UserMessage } from '../types';
export declare function createInfoMessage(message: string, suggestion?: string): UserMessage;
export declare function createWarningMessage(message: string, suggestion?: string): UserMessage;
export declare function createErrorMessage(message: string, suggestion?: string): UserMessage;
export declare const ErrorMessages: {
    duplicateImport: (count: number) => {
        message: string;
        suggestion: string;
    };
    leaveCountedAsConsumed: (performerName: string, date: string) => {
        message: string;
        suggestion: string;
    };
    trackNameMismatch: (photoName: string, aliasName: string) => {
        message: string;
        suggestion: string;
    };
    supplementRecalculateNeeded: () => {
        message: string;
        suggestion: string;
    };
    exportInconsistent: () => {
        message: string;
        suggestion: string;
    };
    missingCanonicalName: (trackName: string) => {
        message: string;
        suggestion: string;
    };
    coordinatorReviewRequired: (count: number) => {
        message: string;
        suggestion: string;
    };
};
