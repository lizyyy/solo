import { JsonPatch, ValidationResult } from "./types";
export declare class PatchValidator {
    private validOperations;
    validatePatch(patch: JsonPatch, index: number): ValidationResult;
    validatePatches(patches: JsonPatch[]): ValidationResult;
}
