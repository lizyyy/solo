import type { TensionRecord, ImportResult } from "../types.js";
import { type ThresholdConfig } from "./processor.js";
export declare function resetImporter(): void;
export declare function firstImport(rawData: Array<{
    originalLineNumber: number;
    timestamp: string;
    beltId: string;
    tensionValue: number;
    unit: string;
    temperature: number | null;
}>, config: ThresholdConfig): ImportResult;
export declare function supplementTemperatureCalibration(supplements: Array<{
    beltId: string;
    timestamp: string;
    calibrationNote: string;
    temperature: number;
}>, config: ThresholdConfig): ImportResult;
export declare function updateUnitConversion(conversionMap: Array<{
    beltId: string;
    fromUnit: string;
    toUnit: string;
    factor: number;
}>, config: ThresholdConfig): ImportResult;
export declare function getExistingRecords(): TensionRecord[];
