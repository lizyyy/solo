import { HTTPRequest, DiffConfig } from '../types';
export interface RequestSignature {
    id: string;
    method: string;
    path: string;
    normalizedPath: string;
    queryHash: string;
    bodyHash: string;
    headersHash: string;
    fullHash: string;
}
export declare class RequestSigner {
    private config;
    private pathPatterns;
    constructor(config: DiffConfig);
    private compilePathPatterns;
    sign(request: HTTPRequest): RequestSignature;
    private normalizePath;
    private hashQuery;
    private normalizeQueryValue;
    private hashBody;
    private hashHeaders;
    private normalizeHeaderValue;
    private normalizeValue;
    private maskValue;
    private shouldIgnoreField;
    private matchFieldPattern;
    private sortArray;
    private isEmptyValue;
    private hash;
}
export declare function createRequestSigner(config: DiffConfig): RequestSigner;
export declare function calculateSimilarity(sig1: RequestSignature, sig2: RequestSignature): number;
export declare function findBestMatch(target: RequestSignature, candidates: RequestSignature[], threshold?: number): {
    signature: RequestSignature;
    score: number;
} | null;
