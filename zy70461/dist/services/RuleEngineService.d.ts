import { Submission, SubmissionStatus, RuleDefinition, RuleVersion } from '../models/types';
export interface ValidationResult {
    valid: boolean;
    status: SubmissionStatus;
    summary: string;
    conclusion: string;
    errors: string[];
    warnings: string[];
}
export declare class RuleEngineService {
    static validateSubmission(submission: Submission, ruleDate?: Date): Promise<ValidationResult>;
    static validateWithRuleId(submission: Submission, ruleVersionId: string): Promise<ValidationResult>;
    static getRuleForSubmission(submission: Submission): RuleVersion | null;
    private static applyRules;
    static createNewRuleVersion(version: string, name: string, description: string, rules: RuleDefinition, effectiveFrom: Date, createdBy: string): RuleVersion;
}
