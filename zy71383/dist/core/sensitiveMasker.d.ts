import { SecretPlaceholder } from './types';
export interface MaskResult {
    maskedContent: Record<string, unknown>;
    detectedSecrets: Array<{
        key: string;
        value: string;
        pattern: string;
    }>;
}
export declare class SensitiveMasker {
    private patterns;
    constructor(customPatterns?: SecretPlaceholder[]);
    mask(obj: Record<string, unknown>): MaskResult;
    private maskRecursive;
    private isPlaceholder;
    private maskString;
    private isSensitiveKey;
    isSecretValue(value: string): boolean;
    addPattern(pattern: SecretPlaceholder): void;
    getPatterns(): SecretPlaceholder[];
}
export declare const masker: SensitiveMasker;
