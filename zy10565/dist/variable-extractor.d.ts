import { HttpRequestRecord, VariableRule, SensitiveRule } from './types';
export declare class VariableExtractor {
    private variableRules;
    private sensitiveRules;
    private variableMappings;
    constructor(variableRules?: VariableRule[], sensitiveRules?: SensitiveRule[], variableMappings?: Record<string, string>);
    extractVariables(record: HttpRequestRecord): HttpRequestRecord;
    private extractFromHeaders;
    private extractFromQueryParams;
    private extractFromUrl;
    private extractFromBody;
    private extractTimestamps;
    private applySensitiveMasking;
    private applyVariableMappings;
    private addVariable;
    private isTokenHeader;
    private isTokenParam;
    private getVariableNameForHeader;
    private getDefaultVariableRules;
    private getDefaultSensitiveRules;
}
