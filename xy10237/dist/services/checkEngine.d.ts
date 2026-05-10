import { Sample, CheckResult, CountryRule } from '../types';
export declare class CheckEngine {
    private rules;
    constructor(customRules?: CountryRule[]);
    getRule(countryCode: string): CountryRule | undefined;
    getAllRules(): CountryRule[];
    addOrUpdateRule(rule: CountryRule): void;
    checkSample(sample: Sample, runNumber?: number): CheckResult;
    private buildResult;
    validateMaterialList(materials: {
        type: string;
        valid: boolean;
    }[]): {
        isValid: boolean;
        issues: string[];
    };
    validateCountryRules(): {
        isValid: boolean;
        details: {
            countryCode: string;
            countryName: string;
            requiredMaterials: number;
        }[];
    };
}
