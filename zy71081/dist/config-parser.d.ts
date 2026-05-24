import { SamplingConfig, ValidationError } from './types';
export declare class ConfigParser {
    private errors;
    private warnings;
    parse(configPath: string): SamplingConfig | null;
    private validateAndTransform;
    private validateVersion;
    private validateSamplingRatio;
    private validateOptionalNumber;
    private validateDecision;
    private validateRules;
    private validateRuleName;
    private validateRulePriority;
    private validateAttributes;
    private validateRuleConsistency;
    getErrors(): ValidationError[];
    getWarnings(): ValidationError[];
    isValid(): boolean;
}
