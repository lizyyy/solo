import { TicketType, TemperatureUnit, TemperatureCheckItem, WeightCheckItem, TicketItem, RejectionReason } from './types';
import { Batch } from './models';
import { ValidationError } from './errors';
export interface TemperatureRule {
    min: number;
    max: number;
    unit: TemperatureUnit;
    materialCodes?: string[];
}
export interface WeightRule {
    maxDeviationPercent: number;
    minDeviationPercent?: number;
    materialCodes?: string[];
}
export interface TicketRule {
    requiredTypes: TicketType[];
    materialCodes?: string[];
}
export interface InspectionRules {
    temperature?: TemperatureRule;
    weight?: WeightRule;
    ticket?: TicketRule;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
}
export declare class RuleEngine {
    private temperatureRules;
    private weightRules;
    private ticketRules;
    private defaultRules;
    setTemperatureRule(materialCode: string, rule: TemperatureRule): void;
    setWeightRule(materialCode: string, rule: WeightRule): void;
    setTicketRule(materialCode: string, rule: TicketRule): void;
    getTemperatureRule(materialCode: string): TemperatureRule;
    getWeightRule(materialCode: string): WeightRule;
    getTicketRule(materialCode: string): TicketRule;
}
export declare function validateTemperatureCheck(items: TemperatureCheckItem[], rule: TemperatureRule): ValidationResult;
export declare function validateWeightCheck(items: WeightCheckItem[], rule: WeightRule): ValidationResult;
export declare function validateTicketCheck(items: TicketItem[], rule: TicketRule): ValidationResult;
export declare function validateRejectionReasons(reasons: RejectionReason[]): ValidationResult;
export declare function calculateWeightDeviationPercent(expected: number, actual: number): number;
export declare function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number;
export declare function canAcceptBatch(batch: Batch): boolean;
export declare function canRejectBatch(batch: Batch): boolean;
export declare function canReplenishBatch(batch: Batch): boolean;
