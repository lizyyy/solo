import type { TensionRecord, InspectionResult, InspectionSummary } from "../types.js";
export declare function setRecords(newRecords: TensionRecord[]): void;
export declare function getRecords(): TensionRecord[];
export declare function getResult(): InspectionResult;
export declare function getSummary(): InspectionSummary;
export declare function resetStore(): void;
