import { DiscrepancyType } from '../types';
export declare const DISCREPANCY_EXPLANATIONS: Record<DiscrepancyType, string>;
export declare const SEVERITY_MAPPING: Record<DiscrepancyType, 'HIGH' | 'MEDIUM' | 'LOW'>;
export declare const FEVER_THRESHOLD = 37.3;
export declare const MEDICATION_EXPIRY_WARNING_DAYS = 3;
