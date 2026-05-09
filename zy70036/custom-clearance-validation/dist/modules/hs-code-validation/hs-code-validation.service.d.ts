import { HsCodeVersionService } from '../version-management/hs-code-version.service';
export interface HsCodeRuleValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    details: {
        formatValid: boolean;
        lengthValid: boolean;
        checkDigitValid: boolean | null;
        numericValid: boolean;
    };
}
export interface HsCodeBatchValidationResult {
    batchId: string;
    totalCodes: number;
    validCodes: number;
    invalidCodes: number;
    mismatchedCodes: number;
    pendingCodes: number;
    sourceComparison: {
        source: string;
        total: number;
        valid: number;
        invalid: number;
    }[];
    crossSourceMismatches: {
        hsCode: string;
        invoiceQuantity: number;
        packingListQuantity: number;
        difference: number;
        productNameInvoice: string;
        productNamePackingList: string;
    }[];
    details: {
        hsCode: string;
        productName: string;
        source: string;
        status: string;
        messages: string[];
    }[];
}
export declare class HsCodeValidationService {
    private readonly hsCodeVersionService;
    constructor(hsCodeVersionService: HsCodeVersionService);
    validateHsCodeFormat(hsCode: string): HsCodeRuleValidationResult;
    private calculateCheckDigit;
    validateHsCodeVersion(id: string): Promise<{
        hsCode: string;
        productName: string;
        validation: HsCodeRuleValidationResult;
    }>;
    validateBatchHsCodes(batchId: string): Promise<HsCodeBatchValidationResult>;
}
