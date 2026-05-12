import { ProjectState, SurveyRecord, SurveyAnswer, ImportResult, CheckResult } from '../types';
export declare class ProjectService {
    static initializeWithSamples(): ProjectState;
    static initializeCustom(config: ProjectState['config']): ProjectState;
    static importSurveys(surveys: SurveyAnswer[]): ImportResult;
    static checkAll(): CheckResult;
    private static calculateStats;
    static getSurveyDetail(id: string): SurveyRecord | undefined;
    static getQuotaUsage(): import("../types").QuotaUsage[];
    static manuallyReserve(surveyId: string, operator: string, reason: string): SurveyRecord;
    static manuallyReject(surveyId: string, operator: string, reason: string): SurveyRecord;
    static generateReport(): {
        summary: {
            total: number;
            valid: number;
            rejected: number;
            overQuota: number;
            needsReview: number;
            pending: number;
        };
        quotaUsage: import("../types").QuotaUsage[];
        channelStats: Record<string, {
            total: number;
            valid: number;
        }>;
        cityStats: Record<string, {
            total: number;
            valid: number;
        }>;
        ageStats: Record<string, {
            total: number;
            valid: number;
        }>;
        needToFill: {
            rule: string;
            criteria: Record<string, string>;
            need: number;
        }[];
        projectInfo: {
            name: string;
            lastUpdatedAt: string;
            processVersion: number;
        };
    };
    static loadSampleData(): ImportResult;
    static getState(): ProjectState;
    static clearData(): void;
}
