import type { TensionRecord } from "../types.js";
export interface ThresholdConfig {
    upperLimit: number;
    lowerLimit: number;
    unit: string;
}
export declare function checkThreshold(value: number, config: ThresholdConfig): boolean;
export declare function processRecords(rawRecords: TensionRecord[], config: ThresholdConfig): TensionRecord[];
export declare function recalculateAfterSupplement(existingRecords: TensionRecord[], supplementRecords: TensionRecord[], config: ThresholdConfig): TensionRecord[];
