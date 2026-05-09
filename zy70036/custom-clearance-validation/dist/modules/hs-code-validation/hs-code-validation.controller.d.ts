import { HsCodeValidationService, HsCodeBatchValidationResult } from './hs-code-validation.service';
export declare class HsCodeValidationController {
    private readonly validationService;
    constructor(validationService: HsCodeValidationService);
    validateHsCode(hsCode: string): import("./hs-code-validation.service").HsCodeRuleValidationResult;
    validateBatch(batchId: string): Promise<HsCodeBatchValidationResult>;
}
