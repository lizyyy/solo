import { ParameterSchema, EventLogEntry, Issue, ParameterType } from '../types';
import { ValidationConfig } from '../types';
export interface ParameterValidationResult {
    parameterName: string;
    status: 'pass' | 'fail' | 'warning' | 'missing';
    message?: string;
    expectedType?: ParameterType;
    actualType?: string;
    expected?: any;
    actual?: any;
}
export declare class ParameterValidator {
    private config;
    constructor(config: ValidationConfig);
    validate(schema: ParameterSchema[], entries: EventLogEntry[]): {
        results: ParameterValidationResult[];
        issues: Issue[];
    };
    private validateRequiredParam;
    private validateOptionalParam;
    private checkType;
    private getType;
    private checkEnum;
    private checkRange;
    private findUndefinedParams;
    private createParameterIssue;
    private getIssueReason;
    private getNextActions;
}
