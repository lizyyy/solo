import { TrialFeedback, PaginatedResponse } from '../types';
export declare const createTrialFeedback: (data: {
    sampleId: string;
    trialUser: string;
    trialDate: string;
    trialPeriod: number;
    trialLocation: string;
    testItems: Array<{
        name: string;
        criteria: string;
        result: "PASS" | "FAIL" | "PARTIAL";
        remarks?: string;
    }>;
    overallRating: number;
    conclusion: string;
    suggestions?: string;
    attachments?: string[];
}, operator: string) => TrialFeedback;
export declare const getTrialFeedbackById: (id: string) => TrialFeedback;
export declare const getTrialFeedbacksBySample: (sampleId: string) => TrialFeedback[];
export declare const listTrialFeedbacks: (params?: {
    sampleId?: string;
    trialUser?: string;
    minRating?: number;
    maxRating?: number;
}, page?: number, pageSize?: number) => PaginatedResponse<TrialFeedback>;
export declare const getTrialFeedbackSummary: (sampleId?: string) => {
    total: number;
    avgRating: number;
    passRate: number;
    byRating: Record<number, number>;
};
