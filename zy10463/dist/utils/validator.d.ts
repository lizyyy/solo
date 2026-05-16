import { ValidationResult } from '../types';
export declare class SchemaValidator {
    private ajv;
    constructor();
    validate(schema: Record<string, unknown>, data: unknown): ValidationResult;
    isValidSchema(schema: Record<string, unknown>): boolean;
}
export declare const validator: SchemaValidator;
