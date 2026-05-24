import { MaskingRule, DiffConfig, HTTPRequest, HTTPResponse } from '../types';
export interface MaskingResult {
    applied: boolean;
    originalValue: string;
    maskedValue: string;
    rule: MaskingRule;
}
export declare class MaskingEngine {
    private rules;
    private compiledPatterns;
    constructor(config: DiffConfig);
    private compilePatterns;
    maskRequest(request: HTTPRequest): HTTPRequest;
    maskResponse(response: HTTPResponse): HTTPResponse;
    private maskHeaders;
    private maskQuery;
    private maskUrl;
    private maskBody;
    private maskString;
    private findRule;
    private applyRule;
    verifyMasking(original: string, masked: string): MaskingResult | null;
    detectMaskingIssues(expectedBody: any, actualBody: any, path?: string): Array<{
        path: string;
        issue: string;
        suggestion: string;
    }>;
}
export declare function createMaskingEngine(config: DiffConfig): MaskingEngine;
export declare const defaultMaskingRules: MaskingRule[];
export declare function loadConfigFromFile(filePath: string): DiffConfig;
export declare function getDefaultConfig(): DiffConfig;
