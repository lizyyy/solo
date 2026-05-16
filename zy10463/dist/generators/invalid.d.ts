import { BaseGenerator } from './base';
export declare class InvalidGenerator extends BaseGenerator {
    private invalidators;
    constructor(schema: Record<string, unknown>, seed: number);
    generate(index: number, fieldPath?: string): {
        data: unknown;
        reason: string;
    };
    private invalidTypeNumberForString;
    private invalidTypeStringForNumber;
    private invalidTypeNullForObject;
    private removeRequiredField;
    private stringExceedsMaxLength;
    private numberExceedsMax;
    private numberBelowMin;
    private invalidEnumValue;
    private makeGenericInvalid;
}
